#!/usr/bin/env node
var gcloud = require('gcloud')({
  projectId: 'flashtag-1383',
  credentials: require('./keyfile.json')
});
var Sequelize = require('sequelize');
var sequelize = new Sequelize('postgres://root:fl45ht4g@104.196.180.89:3306/flashtag');

var vision = gcloud.vision();
var storage = gcloud.storage();
var username = 'katieandlee';


var User = sequelize.define('user', {
  username: {
    type: Sequelize.STRING
  }
}, {
  freezeTableName: true // Model tableName will be the same as the model name
});

User.sync({force: true}).then(function () {
  // Table created
  console.log('user created');
  return User.create({
    username: 'katieandlee'
  });
});

var hasImage = function(imageId, callback) {
    callback(true);    
}

var hasImageTag = function(imageId, tag, callback) {
    callback(true);    
}


// Reference an existing bucket.
var bucket = storage.bucket('flashtag-photos');
  bucket.getFiles({prefix:username+'/'},
    function(err, files, nextQuery) {
      if (!err) {

        files.forEach(function (file) {
            
            hasImage(file.metadata.id, function(hasImage) {
                if(!hasImage) {
                    // get face and label information for this file
                    vision.detect(file, ['face', 'label', 'landmark', 'text'], function(err, detections) {
            
                    if(err===null) {
                        var tags = detections.labels;
                        var record = {};
                        record.landmark = detections.landmark;
                        record.text = detections.text;
                        record.faces = detections.faces;
                        record.username= username;
                        record.id= file.metadata.id;
                        record.name= file.metadata.name;
                        record.timeCreated= new Date(file.metadata.timeCreated);
                        record.size= parseInt(file.metadata.size);
        
                        file.metadata.id.split('/').forEach(function(folder) {
                            tags.push(folder);
                            folder.split(" ").forEach(function(text) {
                                tags.push(text);
                            });
                        });
                        
                        detections.text.forEach(function(text) {
                            tags.push(text);
                            text.split(" ").forEach(function(subtext) {
                                tags.push(subtext);
                            });
                        });
                        
                        if(detections.faces.length>0) {
                            record.labels.push('people');
                        }
                        
                        detections.faces.forEach(function(face) {
                            console.log(face);
                            ['happy', 'hat', 'mad', 'sad', 'surprised'].forEach(function(property) {
                                if(face[property]) {
                                    record.labels.push(property);
                                }
                            });
                        });
                        
                        console.log(record);
                        datastore.save(
                        {
                            key: datastore.key(['image']),
                            data: record,
                        }, function(err) {
                            console.log('saved');
                        });

                        tags.forEach(function(tag) {
                            if(!hasImageTag(file.metadata.id), tag) {
                                datastore.save(
                                {
                                    key: datastore.key(['image']),
                                    data: record,
                                }, function(err) {
                                    console.log('saved');
                                });
                            }
                        });
        
                    }
                });
            }
        

            
          });
        });
    };
  });
