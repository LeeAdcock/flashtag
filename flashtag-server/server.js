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

app.get('/users/:user/tags/:tag', function(req, res) {
  var query = datastore.createQuery('image')
    .filter('username', req.params.user)
    .filter('labels', 'contains', req.params.tag);
  datastore.runQuery(query, function (err, images) {
    if (err) {
      res.status(500).send(err);
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.status(200).send(images);
    }
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