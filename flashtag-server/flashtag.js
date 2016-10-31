#!/usr/bin/env node
var q = require('q');
var async = require('async');
var sharp = require('sharp');
var ExifImage = require('exif').ExifImage;
var moment = require('moment');
var fs = require('fs')
var xml2js = require('xml2js').parseString;

var ReadWriteLock = require('rwlock');
var lock = new ReadWriteLock();

var gcloud = require('gcloud')({
  projectId: 'flashtag-1383',
  credentials: require('./keyfile.json')
});

const NodeCache = require( "node-cache" );
const tagCache = new NodeCache( { stdTTL: 60, useClones: false } );

var username = 'katieandlee';
var threadPoolSize = 8;

// Google cloud
var vision = gcloud.vision();
var storage = gcloud.storage();

// Database model
var model = require('./model/model.js');

/**
 * Apply a tag to a photo. Returns a promise, or can invoke a callback.
 * 
 * Implemented using a cache to provide quick access to recently used tags, and
 * write locking for high-volume async calls.
 */
var applyTag = function(photoObj, tag, transaction) {
    console.log('applyTag', tag);
    var defer = q.defer();
    lock.writeLock(tag, function (releaseLock) {
        var tagObj = tagCache.get(tag)
        console.log('tag', tag);
        if(tagObj==undefined) {
            console.log('applyTag','cacheMiss', tag);
            
            model.tag.findOrCreate({
                where: {
                    tag: tag
                },transaction:transaction})
            .spread(function(tagObj, created) {
                console.log('got tag', tag, created);
                tagCache.set(tag, tagObj);
                model
                    .phototag
                    .create({photoId:photoObj.id, tagTag:tagObj.tag},{transaction:transaction})
                    .then(function(photoTagObj) {
                        releaseLock();
                        defer.resolve();
                        console.log('tag applied', tag);
                    }).catch(function(err){
                        console.log('unable to tag', err);
                    });
            });
        } else {
            console.log('applyTag','cacheHit', tag);
            model.phototag
                .create({photoId:photoObj.id, tagTag:tagObj.tag},{transaction:transaction})
                .then(function(photoTagObj) {
                releaseLock();
                defer.resolve();
                console.log('tag applied', tag);
            });
        }    
    });
    return defer.promise;
}

function getTagsFromPath(file) {
    console.log('Get tags from path');
    var defer = q.defer();
    var tags = [];
    
    var folders = file.metadata.name.split('/');
    folders.shift(); // remove first element, the username
    folders.pop(); // remove file name
    defer.resolve(folders);

    return defer.promise;    
}

function getTagsFromContent(file, photo) {
    console.log('Get tags from content');
    var defer = q.defer();
    
    // get face and label information for this file
    vision.detectLabels(file, function(err, labels) {
        console.log('Labels', labels, err);
        if(err!==null) { 
            defer.reject(err);
        } else {

            var tags = [];

            labels.forEach(function(label) {tags.push(label)});
            /*
            if(detections.landmarks) {
                detections.landmarks.forEach(function(landmark) {tags.push(landmark)});
            }
            
            if(detections.text) {
                detections.text.forEach(function(text) {
                    tags.push(text);
                    text.split("[\s\n]{1}").forEach(function(subtext) {
                        tags.push(subtext);
                    });
                });
            }
            
            if(detections.faces) {
                tags.push('people');
                
                detections.faces.forEach(function(face) {
                    console.log(face);
                    ['happy', 'hat', 'mad', 'sad', 'surprised'].forEach(function(property) {
                        if(face[property]) {
                            tags.push(property);
                        }
                    });
                });
            }
            */
            defer.resolve(tags);
        }
    });

    return defer.promise;    
}

function processExif(file, photo) {
    console.log('Process exif');
    var defer = q.defer();
    var tags = [];

    var data = [];
    var fileStream = file.createReadStream();
    fileStream.on('data', function(chunk) {
        data.push(chunk);
    });
    
    fileStream.on('end', function() {
        try {
            new ExifImage({ image : Buffer.concat(data) }, function (error, data) {
                console.log('exif', error, data);
                if(data) {
                    var created = data.exif.DateTimeOriginal || data.exif.CreateDate || data.image.ModifyDate;
                    var createdMoment = moment(created, 'YYYY:MM:DD HH:mm:ss', 'en');
                    photo.update({
                        createDate: createdMoment.toDate(),
                        height: data.image.ImageHeight,
                        width: data.image.ImageWidth,
                        rotation: {1:0, 8:-90, 3:90, 6:180}[data.image.Orientation]
                    });
                }
                defer.resolve(tags);
            });
        } catch (err) {
            defer.reject(err);
        }
    });

    return defer.promise;    
}

function getTagsFromXmpMeta(file, photo) {

    console.log('Process xmp');
    var defer = q.defer();
    var data = [];
    var fileStream = file.createReadStream();
    fileStream.on('data', function(chunk) {
        data.push(chunk);
    });
    
    fileStream.on('end', function() {
        try {
            var xmpRegEx = /<mwg-rs:RegionList.*<\/mwg-rs:RegionList>/;
            var match = xmpRegEx.exec(data);
            if(match) {
                xml2js(match[0], function (err, result) {
                    if(err) {
                        console.log('xmp parse', err);
                        defer.resolve([]);
                    } else {
                        var names = [];
                        result['mwg-rs:RegionList']['rdf:Bag'][0]['rdf:li'].forEach(function(value) {
                            var item = value['rdf:Description'][0]['$'];
                            var name = item['mwg-rs:Name'];
                            var type = item['mwg-rs:Type'];
                            if(type === 'Face') {

                                var area = value['rdf:Description'][0]['mwg-rs:Area'][0]['$'];
                                var x = area['stArea:x'];
                                var y = area['stArea:y'];
                                var width = area['stArea:h'];
                                var height = area['stArea:w'];

                                names.push(name);
                            }
                        });
                        
                        console.log('resolve', names);
                        defer.resolve(names);
                    }
                });
            } else {
                defer.resolve([]);
            }
            
        } catch (err) {
            console.log(err);
            defer.reject(err);
        }
    });
    return defer.promise;
}

function suggestTags(file, photo) {
    console.log('scanning');
    var defer = q.defer();
    
    var promises = [];
    
    promises.push(getTagsFromPath(file));
    //promises.push(getTagsFromContent(file, photo));
    var isJpegRegex = /jpg|jpeg/i;
    if(file.name.match(isJpegRegex)) {
        promises.push(getTagsFromXmpMeta(file, photo));
        //promises.push(processExif(file, photo))
    }
    
    q.all(promises).then(function(tagSets) {
        console.log('processing tags', tagSets);

        var tags = tagSets.reduce((a, b) => a.concat(b));

        tags = tags
            // if tag has multiple words delimited by space, split and also add words as individual tags
            .reduce((a, b) => a.concat(b.split(' ')).concat([b]), tags) 
            // remove non-word characters from within tags
            .map(x=>x.replace(/(\r\n|\n|\r|[^\w])/gm,''))
            // remove small tags
            .filter(x=>x.length>2)
            // tags must be lower case
            .map(x=>x.toLowerCase())
            // filter out duplicate tags
            .filter((item, pos, array) => (array.indexOf(item) == pos));

        defer.resolve(tags);
    }).catch(function(err) {
        console.log('tag', err);
    })
    return defer.promise;
}

function applyTags(tags, photo, transaction) {
    console.log('applyTags', tags);
    var defer = q.defer();
    
    getPhotoTags(photo, transaction)
        .then(function(tagObjs) {
            tagObjs
                .map(tagObj => tagObj.tagTag)
                .filter(tag => tags.indexOf(tag)!=-1)
                .forEach(tag => tags.splice(tags.indexOf(tag), 1));
            return q.fcall(function () {
                return tags;
            });
        }).then(function (tags) {
            console.log('Tags', tags);
            if(tags.length>0) {
                async.eachLimit(tags, threadPoolSize, (tag, complete)=>applyTag(photo, tag, transaction).then(complete), function(err) {console.log('tags done', err); defer.resolve()});
            } else {
                defer.resolve();
            }
        });
        
    return defer.promise;
}

function getPhoto(file, user, transaction) {
    console.log("Process", file.metadata.name);
    var defer = q.defer();
    model.photo.findOrCreate({
        where: { 
            name: file.metadata.name,
            md5Hash: file.metadata.etag.replace('=',''),
            size: parseInt(file.metadata.size),
            userId: user.id //TODO
        },
        transaction:transaction}).spread(function(photo, created) {
        defer.resolve(photo);
    })
    .catch(function(err){
        defer.reject(err);
    });
    return defer.promise;
}

function getFiles(user, callback) {
    console.log('Getting files', user.username);
    var bucket = storage.bucket('flashtag-photos');
    bucket.getFiles({prefix:user.username+'/family/201'},  function(err, files) {
        if(err) {
            console.log('getFiles', err);
            return;
        }
        console.log("Retrieved files", files.length);
        async.eachLimit(
            files.filter(file => parseInt(file.metadata.size)>0),
            threadPoolSize, 
            (file, complete) => callback(file, complete));
    });
    
 
}

function getUser(username) {
    console.log('Getting user', username);
    var defer = q.defer();
    model.user.findOrCreate({
        where: {
            username: username
        }
    }).spread(function(user, created) {
        defer.resolve(user);
    });
    return defer.promise;
}

function getPhotoTags(photo, transaction) {
    console.log('Getting tags', username);
    var defer = q.defer();
    model.phototag
        .findAll({where:{photoId:photo.id}, transaction:transaction})
        .then(function(tags) {
            defer.resolve(tags);
        });
    return defer.promise;
}

model.sync({force: false})
    .then(() => getUser(username))
    .then(function(user) {
        getFiles(user, function(file, complete) {
            model.transaction(function (transaction) {
                return getPhoto(file, user, transaction).then(function(photo){
                    return suggestTags(file, photo)
                      .then(tags => applyTags(tags, photo, transaction), err => console.log("applytags", err))
                      .then(console.log('cache', tagCache.getStats()))
                }, function(err) { throw new Error(err)})
            }).then(function() {
                console.log('photo done', file.metadata.name);
                complete();
            }).catch(function(err) {
                console.log('photo aborted', file.metadata.name, err);
                complete();
            });
        });
    });
    