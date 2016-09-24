#!/usr/bin/env node
var q = require('q');
var async = require('async');

var ReadWriteLock = require('rwlock');
var lock = new ReadWriteLock();

var gcloud = require('gcloud')({
  projectId: 'flashtag-1383',
  credentials: require('./keyfile.json')
});

const NodeCache = require( "node-cache" );
const tagCache = new NodeCache( { stdTTL: 60, useClones: false } );

var username = 'katieandlee';

// Google cloud
var vision = gcloud.vision();
var storage = gcloud.storage();

// Database model
var model = require('./model/model.js');

var applyTag = function(photoObj, tag, tagComplete) {

    lock.writeLock(tag, function (releaseLock) {
        tagCache.get(tag, function(tagObj) {
            if(tagObj==undefined) {
                model.tag.findOrCreate({
                    where: {
                        tag: tag
                    }
                }).spread(function(tagObj) {
                    tagCache.set(tag, tagObj);
                    model.phototag.create({photoId:photoObj.id, tagTag:tagObj.tag}).then(function(photoTagObj) {
                        releaseLock();
                        tagComplete();
                    });
                });
            } else {
                model.phototag.create({photoId:photoObj.id, tagTag:tagObj.tag}).then(function(photoTagObj) {
                    releaseLock();
                    tagComplete();
                });
            }    
        });
    });
}

model.sync({force: true}).then(function(){
    console.log("synced");
    
    model.user.findOrCreate({
        where: {
            username: 'katieandlee'
        }
    });
    
    // Reference an existing bucket.
    var bucket = storage.bucket('flashtag-photos');
    bucket.getFiles({prefix:username+'/family/2016'},  function(err, files) {

        function processFile(file, photoComplete) {
            console.log("process", file.metadata.name);

            if(parseInt(file.metadata.size)===0) {
                photoComplete();
            } else {
                var photoDefer = q.defer();
                model.photo.findOrCreate({
                    where: { 
                        path: file.metadata.id,
                        md5Hash: file.metadata.etag,
                        size: parseInt(file.metadata.size),
                        userId: 1 //TODO
                    }
                }).spread(function(photoObj, created) {
                    console.log('created>>', created);
                    if(created) {
                        scanPhoto(photoObj);
                    } else {
                        photoComplete();
                    }
                });
                
                function scanPhoto(photoObj) {
                    console.log('scanning');
                    // get face and label information for this file
                    vision.detect(file, [/*'face',*/ 'label', 'landmark', 'text'], function(err, detections) {
            
                        if(err!==null) { 
                            photoComplete(); 
                        } else {                
                            var tags = [];
                            detections.labels.forEach(function(label) {tags.push(label)});
                            detections.landmarks.forEach(function(landmark) {tags.push(landmark)});
        
                            var folders = file.metadata.name.split('/');
                            folders.pop();
                            folders.shift();
                            folders.forEach(function(folder) {
                                tags.push(folder);
                                folder.split(" ").forEach(function(text) {
                                    tags.push(text);
                                });
                            });
                            
                            detections.text.forEach(function(text) {
                                tags.push(text);
                                text.split("[\s\n]{1}").forEach(function(subtext) {
                                    tags.push(subtext);
                                });
                            });
                            
                            if(detections.faces && detections.faces.length>0) {
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
                            
                            function applyTagToPhoto(tag, tagComplete) {
                                applyTag(photoObj, tag, tagComplete);
                            }
                            
                            tags.forEach(function(tag){
                                var splitTags = tag.split(" ");
                                if(splitTags.length>1) {
                                    splitTags.forEach(function(subtag) {
                                        tags.push(subtag);
                                    });
                                }
                            });
                            
                            tags = tags
                                .map(x=>x.replace(/[^\w\s]/gi, ''))
                                .map(x=>x.replace(/(\r\n|\n|\r)/gm,""))
                                .filter(x=>x.length>2)
                                .map(x=>x.toLowerCase())
                                .filter((item, pos) => (tags.indexOf(item) == pos));

                            console.log('tags', tags);
                            
                            async.eachLimit(tags, 5, applyTagToPhoto, photoComplete);
                        }
                    });
                }
            }

        }
        console.log("FILE COUNT", files.length);
        async.eachLimit(files, 5, processFile);

        console.log("Done");

    }); 
});