'use strict';

var format = require('util').format;
var express = require('express');
var gcloud = require('gcloud')({
  projectId: 'flashtag-1383',
  credentials: require('./keyfile.json')
});
var app = express();
app.set('view engine', 'jade');
app.set('port', process.env.PORT || 3000);
app.use(express.static('../flashtag-client'));
var datastore = gcloud.datastore();

// Database model
var model = require('./model/model.js');

String.prototype.hashCode = function() {
  var hash = 0, i, chr, len;
  if (this.length === 0) return hash;
  for (i = 0, len = this.length; i < len; i++) {
    chr   = this.charCodeAt(i);
    hash  = ((hash << 5) - hash) + chr;
    hash |= 0; // Convert to 32bit integer
  }
  return hash;
};

// Multer is required to process file uploads and make them available via
// req.files.
var multer = require('multer')({
  inMemory: true,
  fileSize: 5 * 1024 * 1024 // no larger than 5mb, you can change as needed.
});

app.get('/users/:user/photos', function(req, res) {
  var query = datastore.createQuery('image').filter('username', req.params.user);
  datastore.runQuery(query, function (err, images) {
    if (err) {
      res.status(500).send(err);
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.status(200).send(images);
    }
  });
});

app.get('/users/:username/tags/', function(req, res) {
  model.sequelize.query("select phototag.tagTag as tag, count(1) as count from  \
    (select * from user where username=:username) as user  \
    inner join photo on user.id=photo.userId \
    inner join phototag on photo.id=phototag.photoId \
    group by phototag.tagTag",
    { replacements: req.params, type: model.sequelize.QueryTypes.SELECT }
    )
    .then(function(tags) {
      tags.forEach(function(tag){
        tag.ref={
          details:'/users/'+req.params.username+'/tags/'+tag.tag,
          photos:'/users/'+req.params.username+'/tags/'+tag.tag+"/photos"
        }
      });
      res.status(200).send(tags);
    });
});

app.get('/users/:username/tags/:tag', function(req, res) {
  model.sequelize.query("select phototag.tagTag as tag, count(1) as count from \
    (select * from user where username=:username) as user \
    inner join photo on user.id=photo.userId \
    inner join (select * from phototag where tagTag=:tag) as specificphototag on photo.id=specificphototag.photoId \
    inner join phototag as phototag on photo.id=phototag.photoId \
    group by phototag.tagTag \
    order by count desc \
    limit 10",
    { replacements: req.params, type: model.sequelize.QueryTypes.SELECT }
    )
    .then(function(tags) {
      tags.forEach(function(tag){
        tag.ref={
          details:'/users/'+req.params.username+'/tags/'+tag.tag,
          photos:'/users/'+req.params.username+'/tags/'+tag.tag+"/photos"
        }
      });
      res.status(200).send(
        {
          tag: req.params.tag,
          count: tags.reduce((previous, current) => previous+=(current.tag===req.params.tag)?current.count:0, 0),
          ref: {
            photos:'/users/'+req.params.username+'/tags/'+req.params.tag+"/photos"
          },
          similar: tags.filter(current=>current.tag!==req.params.tag)
        });
    });
});

app.get('/users/:username/tags/:tag/photos', function(req, res) {
  model.sequelize.query("select photo.md5Hash as id, size from  \
    (select * from user where username=:username) as user  \
    inner join photo on user.id=photo.userId \
    inner join (select * from phototag where tagTag=:tag) as phototag on photo.id=phototag.photoId",
    { replacements: req.params, type: model.sequelize.QueryTypes.SELECT }
    )
    .then(function(photos) {
      photos.forEach(function(photo){
        photo.ref={
          details:'/users/'+req.params.username+'/photos/'+photo.id,
          download:'/users/'+req.params.username+'/photos/'+photo.id+'/download'
        }
      });
      res.status(200).send(
        {
          tag: req.params.tag,
          count: photos.length,
          photos: photos,
          ref: {
          },
        });
    });
});


app.get('/users/:user/photos/:photo', function(req, res) {
  console.log(req.params.photo);  
  var key = datastore.key(['image', parseInt(req.params.photo)], req.params.photo);
  console.log(key);
  datastore.get(key, function(err,image) {
    console.log(err, image);
    if (err) {
      res.status(500).send(err);
    } else {
      if(image.data.username!==req.params.user) {
        res.status(401);
      } else {
        res.setHeader('Content-Type', 'application/json');
        res.status(200).send(image.data);
      }
    }
  });

});


// Process the file upload and upload to Google Cloud Storage.
app.post('/photo', multer.single('file'), function (req, res, next) {
  if (!req.file) {
    return res.status(400).send('No file uploaded.');
  }
    
  var promise = new Promise(function(resolve, reject) {
      // Create a new blob in the bucket and upload the file data.
      var bucket = gcloud.storage().bucket('flashtag-photos');
      var blob = bucket.file(req.file.originalname);
      var blobStream = blob.createWriteStream();
    
      blobStream.on('error', function (err) {
        reject();
        console.log(err);
        return next(err);
      });
    
      blobStream.on('finish', function () {

        // The public URL can be used to directly access the file via HTTP.
        gcloud.vision().detect(blob, ['label', 'landmark', 'text'], function(err, detections) {
            console.log(err, req.file.originalname, detections);
            resolve(detections);
        });
      });
    
      blobStream.end(req.file.buffer);
  });

  promise.then(function(detections) {
    res.status(200).send(detections);
  });
});

var server = app.listen(process.env.PORT || '8080', function () {
  console.log('App listening on port %s', server.address().port);
  console.log('Press Ctrl+C to quit.');
});