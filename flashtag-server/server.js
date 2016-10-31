'use strict';

var express = require('express');
var sharp = require('sharp');

// Google cloud
var gcloud = require('gcloud')({
  projectId: 'flashtag-1383',
  credentials: require('./keyfile.json')
});
var vision = gcloud.vision();
var storage = gcloud.storage();

var app = express();
app.set('view engine', 'jade');
app.set('port', process.env.PORT || 80);
app.use(express.static('../flashtag-client'));


// Database model
var model = require('./model/model.js');

// Multer is required to process file uploads and make them available via
// req.files.
var multer = require('multer')({
  inMemory: true,
  fileSize: 5 * 1024 * 1024 // no larger than 5mb, you can change as needed.
});

app.use(function(err, req, res, next) {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

app.get('/api/users/:username', function(req, res) {
  res.status(200).send({
    ref: {
      photos:'/api/users/'+req.params.username+'/photos',
      tags:'/api/users/'+req.params.username+'/tags',
      search:'/api/users/'+req.params.username+'/search'
    }
  });
});

app.get('/api/users/:username/tags/', function(req, res) {
  model.query("select tags.name, count, tags.createDate as modified, md5Hash from \
    ( \
        select phototag.tagTag as name, count(1) as count, max(photo.createDate) as createDate from \
        (select * from user where username=:username) as user \
        inner join photo on user.id=photo.userId \
        inner join phototag on photo.id=phototag.photoId \
        group by phototag.tagTag\
    ) as tags \
    inner join ( \
        select max(photo.id) as id, phototag.tagTag as name, photo.createDate as createDate from \
            (select * from user where username=:username) as user \
            inner join photo on user.id=photo.userId \
            inner join phototag on photo.id=phototag.photoId \
            group by phototag.tagTag, photo.createDate \
    ) as userphotos on userphotos.name=tags.name and userphotos.createDate=tags.createDate \
    inner join photo on userphotos.id=photo.id",
    req.params)
    .then(function(tags) {
      tags.forEach(function(tag){
        tag.ref={
          details:'/api/users/'+req.params.username+'/tags/'+tag.name,
          photos:'/api/users/'+req.params.username+'/tags/'+tag.name+"/photos",
          recent: {
            details:'/api/users/'+req.params.username+'/photos/'+encodeURIComponent(tag.md5Hash),
            download: {
              nano:'/api/users/'+req.params.username+'/photos/'+encodeURIComponent(tag.md5Hash)+'/download/nano',
              micro:'/api/users/'+req.params.username+'/photos/'+encodeURIComponent(tag.md5Hash)+'/download/micro',
              thumb:'/api/users/'+req.params.username+'/photos/'+encodeURIComponent(tag.md5Hash)+'/download/thumb',
              small:'/api/users/'+req.params.username+'/photos/'+encodeURIComponent(tag.md5Hash)+'/download/small',
              medium:'/api/users/'+req.params.username+'/photos/'+encodeURIComponent(tag.md5Hash)+'/download/medium',
              large:'/api/users/'+req.params.username+'/photos/'+encodeURIComponent(tag.md5Hash)+'/download/large'
            }
          }
        }
        tag.md5Hash = undefined;
        tag.createDate = undefined;
      });
      res.status(200).send
      ({
        count: tags.length,
        tags: tags
      });
    });
});

app.get('/api/users/:username/tags/:tag', function(req, res) {
  model.query("select tags.tag, tags.count, recentphotos.lastModified as modified from  \
  ( \
      select phototag.tagTag as tag, count(1) as count from \
      (select * from user where username=:username) as user \
      inner join photo on user.id=photo.userId \
      inner join (select * from phototag where tagTag=:tag) as specificphototag on photo.id=specificphototag.photoId \
      inner join phototag as phototag on photo.id=phototag.photoId \
      group by phototag.tagTag\
      order by count desc\
      limit 10\
  ) tags inner join (\
      select phototag.tagTag as tag, max(photo.createDate) as lastModified from \
      (select * from user where username=:username) as user \
      inner join photo on user.id=photo.userId \
      inner join phototag on photo.id=phototag.photoId \
      group by phototag.tagTag\
  ) recentphotos on recentphotos.tag=tags.tag\
  inner join (\
      select phototag.tagTag as tag, max(photo.createDate) as lastModified from \
      (select * from user where username=:username) as user \
      inner join photo on user.id=photo.userId \
      inner join phototag on photo.id=phototag.photoId \
      group by phototag.tagTag \
  ) as allphototags on allphototags.tag=recentphotos.tag and allphototags.lastModified=recentphotos.lastModified \
  ORDER BY recentphotos.lastModified",
    req.params)
    .then(function(tags) {
      tags.forEach(function(tag){
        
        tag.recent = {
          modified: tag.modified,
          details:'/api/users/'+req.params.username+'/photos/'+encodeURIComponent(tag.md5Hash),
          download: {
            nano:'/api/users/'+req.params.username+'/photos/'+encodeURIComponent(tag.md5Hash)+'/download/nano',
            micro:'/api/users/'+req.params.username+'/photos/'+encodeURIComponent(tag.md5Hash)+'/download/micro',
            thumb:'/api/users/'+req.params.username+'/photos/'+encodeURIComponent(tag.md5Hash)+'/download/thumb',
            small:'/api/users/'+req.params.username+'/photos/'+encodeURIComponent(tag.md5Hash)+'/download/small',
            medium:'/api/users/'+req.params.username+'/photos/'+encodeURIComponent(tag.md5Hash)+'/download/medium',
            large:'/api/users/'+req.params.username+'/photos/'+encodeURIComponent(tag.md5Hash)+'/download/large'
          }
        };

        tag.ref={
          details:'/api/users/'+req.params.username+'/tags/'+tag.tag,
          photos:'/api/users/'+req.params.username+'/tags/'+tag.tag+"/photos"
        }
      });
      res.status(200).send(
        {
          tag: req.params.tag,
          count: tags.reduce((previous, current) => previous+=(current.tag===req.params.tag)?current.count:0, 0),
          ref: {
            photos:'/api/users/'+req.params.username+'/tags/'+req.params.tag+"/photos"
          },
          similar: tags.filter(current=>current.tag!==req.params.tag)
        });
    });
});

app.get('/api/users/:username/tags/:tag/photos', function(req, res) {
  model.query("select photo.md5Hash as id, size from  \
    (select * from user where username=:username) as user  \
    inner join photo on user.id=photo.userId \
    inner join (select * from phototag where tagTag=:tag) as phototag on photo.id=phototag.photoId",
    req.params)
    .then(function(photos) {
      photos.forEach(function(photo){
        photo.ref={
          details:'/api/users/'+req.params.username+'/photos/'+encodeURIComponent(photo.id),
          download: {
            nano:'/api/users/'+req.params.username+'/photos/'+encodeURIComponent(photo.id)+'/download/nano',
            micro:'/api/users/'+req.params.username+'/photos/'+encodeURIComponent(photo.id)+'/download/micro',
            thumb:'/api/users/'+req.params.username+'/photos/'+encodeURIComponent(photo.id)+'/download/thumb',
            small:'/api/users/'+req.params.username+'/photos/'+encodeURIComponent(photo.id)+'/download/small',
            medium:'/api/users/'+req.params.username+'/photos/'+encodeURIComponent(photo.id)+'/download/medium',
            large:'/api/users/'+req.params.username+'/photos/'+encodeURIComponent(photo.id)+'/download/large'
          }
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

app.get('/api/users/:username/search', function(req, res) {
  var sort = {
    "created": "ifnull(createdate, photo.createdate)",
    "id": "id"
  }[req.query.sort || 'created']
  var direction = {
    "asc": "",
    "desc": "desc"
  }[req.query.sortDirection || 'desc']
  var limit = (typeof req.query.limit == "number") ? req.query.limit : 250;

  var tags = req.query.tags.split(",").map(x=>x.trim()).filter(x=>x.length>2);

  model.query("select md5Hash as id,size,photo.height,width,rotation, ifnull(createdate, photo.createdat) as createDate, GROUP_CONCAT(phototag.tagtag) as tagnames, quantity \
    from ( \
        select phototag.photoId as id, count(1) as quantity \
        from (select * from user where username=:username) as user \
        inner join photo on user.id=photo.userId \
        inner join phototag on phototag.photoid = photo.id \
        where phototag.tagTag in (:tags) \
        group by phototag.photoId \
        having quantity=:tagCount \
    ) taggedPhotos \
    inner join photo on taggedPhotos.id = photo.id \
    inner join phototag on photo.id=phototag.photoId \
    group by photo.id, quantity \
    order by :sort :direction LIMIT :limit",
  {
    sort: sort,
    direction: direction,
    limit: limit,
    username: req.params.username,
    tagCount: tags.length, 
    tags: tags
  })
   .then(function(photos) {
      photos.forEach(function(photo) {
        photo.tags = [];
        photo.tagnames.split(',').forEach(function(tag) {
          photo.tags.push({
            name: tag,
            rel: {
              details: '/api/users/' + req.params.username + '/tags/' + tag,
              photos: '/api/users/' + req.params.username + '/tags/' + tag + '/photos',
            }
          });
        });
        photo.tagnames = undefined;
        photo.ref = {
          download: {
            nano:'/api/users/'+req.params.username+'/photos/'+encodeURIComponent(photo.id)+'/download/nano',
            micro:'/api/users/'+req.params.username+'/photos/'+encodeURIComponent(photo.id)+'/download/micro',
            thumb:'/api/users/'+req.params.username+'/photos/'+encodeURIComponent(photo.id)+'/download/thumb',
            small:'/api/users/'+req.params.username+'/photos/'+encodeURIComponent(photo.id)+'/download/small',
            medium:'/api/users/'+req.params.username+'/photos/'+encodeURIComponent(photo.id)+'/download/medium',
            large:'/api/users/'+req.params.username+'/photos/'+encodeURIComponent(photo.id)+'/download/large'
          }
        }
      });
      
      var similar = [];
      model.query("\
        select * from \
          (select phototag.tagTag as tag, max(ifnull(createdate, photo.createdate)) as createDate, count(1) as quantity \
          from ( \
              select phototag.photoId as id, count(1) as quantity \
              from (select * from user where username=:username) as user \
              inner join photo on user.id=photo.userId \
              inner join phototag on phototag.photoid = photo.id \
              where phototag.tagTag in (:tags) \
              group by phototag.photoId \
              having quantity=:tagCount \
          ) taggedPhotos \
          inner join photo on taggedPhotos.id = photo.id \
          inner join phototag on photo.id=phototag.photoId \
          group by phototag.tagTag \
          ) as tags \
        inner join phototag on phototag.tagTag=tags.tag \
        inner join photo on photo.id=phototag.photoId and photo.createDate=tags.createDate \
        inner join (select * from user where username=:username) as user on user.id=photo.userId \
        having quantity>1 \
        order by quantity desc, tags.createdate desc \
        limit 50"
        ,   { 
          username: req.params.username,
          tagCount: tags.length, 
          tags: tags
        }).then(function(tags) {
          
          tags.forEach(function(tag){
            console.log(tag);
            similar.push({
              name: tag.tag,
              count: tag.quantity,

              recent: {              
                details:'/api/users/'+req.params.username+'/photos/'+encodeURIComponent(tag.md5Hash),
                modified: tag.createDate,
                download: {
                  nano:'/api/users/'+req.params.username+'/photos/'+encodeURIComponent(tag.md5Hash)+'/download/nano',
                  micro:'/api/users/'+req.params.username+'/photos/'+encodeURIComponent(tag.md5Hash)+'/download/micro',
                  thumb:'/api/users/'+req.params.username+'/photos/'+encodeURIComponent(tag.md5Hash)+'/download/thumb',
                  small:'/api/users/'+req.params.username+'/photos/'+encodeURIComponent(tag.md5Hash)+'/download/small',
                  medium:'/api/users/'+req.params.username+'/photos/'+encodeURIComponent(tag.md5Hash)+'/download/medium',
                  large:'/api/users/'+req.params.username+'/photos/'+encodeURIComponent(tag.md5Hash)+'/download/large'
                }
              },

              ref:{
                details:'/api/users/'+req.params.username+'/tags/'+tag.tag,
                photos:'/api/users/'+req.params.username+'/tags/'+tag.tag+"/photos"
              }
            });
          })
          
          res.status(200).send({
            photos:photos,
            similar:similar
          });
        });
    });
});


app.get('/api/users/:username/photos/:photo', function(req, res) {

  model.query("select md5Hash as id, size, height, width, rotation, ifnull(createdate, photo.createdat) as createDate, GROUP_CONCAT(phototag.tagtag) as tagnames from \
  (select * from user where username=:username) as user \
  inner join (select * from photo where md5hash=:photo) as photo on user.id=photo.userId \
  inner join phototag on photo.id=phototag.photoId \
  group by photo.id \
  order by ifnull(createdate, photo.createdat) desc",
  req.params)
    .then(function(photos) {

        var tags = [];
        photos[0].tagnames.split(',').forEach(function(tag) {
          tags.push({
            name: tag,
            rel: {
              details: '/api/users/' + req.params.username + '/tags/' + tag,
              photos: '/api/users/' + req.params.username + '/tags/' + tag + '/photos',
            }
          });
        });

        res.status(200).send(
        {
          id: req.params.photo,
          width: photos[0].width,
          height: photos[0].height,
          rotation: photos[0].rotation,
          size: photos[0].size,
          tags: tags,
          ref: {
            download: {
              nano:'/api/users/'+req.params.username+'/photos/'+encodeURIComponent(req.params.photo)+'/download/nano',
              micro:'/api/users/'+req.params.username+'/photos/'+encodeURIComponent(req.params.photo)+'/download/micro',
              thumb:'/api/users/'+req.params.username+'/photos/'+encodeURIComponent(req.params.photo)+'/download/thumb',
              small:'/api/users/'+req.params.username+'/photos/'+encodeURIComponent(req.params.photo)+'/download/small',
              medium:'/api/users/'+req.params.username+'/photos/'+encodeURIComponent(req.params.photo)+'/download/medium',
              large:'/api/users/'+req.params.username+'/photos/'+encodeURIComponent(req.params.photo)+'/download/large'
            }
          }
        });
      });
});

app.get('/api/users/:username/photos/:photo/download/:size*?', function(req, res) {
    if(req.get('If-None-Match')=='"'+req.params.photo+'"') {
      res.status(304).send("unmodified");
    } else {
      model.user.findOne({
          where: {
              username: req.params.username
          }
      }).then(function(user) {
  
        model.photo.findOne({
            where: { 
                md5Hash: req.params.photo,
                userId: user.id
            }
        }).then(function(photo) {
          
          var bucket = storage.bucket('flashtag-photos');
          var file = bucket.file(photo.name);
          
          res.setHeader('ETag', '"' + req.params.photo + '"');
          res.header("Cache-Control", "max-age=2592000"); // 30 days
  
          res.writeHead(200, {
            'Content-type': 'image/jpg'
          });
  
          var size = {
            nano: {height:25, width:25},
            micro: {height:75, width:75},
            thumb: {height:150, width:150},
            small: {height:480, width:640}, // vga
            medium: {height:600, width:800}, // svga
            large: {height:720, width:1280}, // 720p
          }[req.params.size || 'small'];
  
          try
          {
            file
              .createReadStream()
              .pipe(
                sharp()
                .resize(size.height, size.width)
                .rotate()
                .on('error', function (err) { 
                  console.log(err);
                })
              )
              .pipe(res);
          } catch (err) {
            res.status(500).send(err);
          }
        });
      });
    }
});

app.get('/api/users/:username/photos', function(req, res) {
  console.log(req.query);
  var sort = {
    "created": "ifnull(createdate, photo.createdate)",
    "id": "id"
  }[req.query.sort || 'created']
  var direction = {
    "asc": "",
    "desc": "desc"
  }[req.query.sortDirection || 'desc']
  var limit = (typeof req.query.limit == "number") ? req.query.limit : 250;
  
  model.query("select md5Hash as id, size, height, width, rotation, ifnull(createdate, photo.createdat) as createDate, GROUP_CONCAT(phototag.tagtag) as tagnames from \
  (select * from user where username=:username) as user \
  inner join photo on user.id=photo.userId \
  inner join phototag on photo.id=phototag.photoId \
  group by photo.id \
  order by "+sort+" "+direction +" LIMIT "+limit,
  req.params)
    .then(function(photos) {
      photos.forEach(function(photo){
        photo.tags = [];
        photo.tagnames.split(',').forEach(function(tag) {
          photo.tags.push({
            name: tag,
            rel: {
              details: '/api/users/' + req.params.username + '/tags/' + encodeURIComponent(tag),
              photos: '/api/users/' + req.params.username + '/tags/' + encodeURIComponent(tag) + '/photos',
            }
          });
        });
        photo.tagnames = undefined;
        
        photo.ref={
          details:'/api/users/'+req.params.username+'/photos/'+encodeURIComponent(photo.id),
          download: {
            nano:'/api/users/'+req.params.username+'/photos/'+encodeURIComponent(photo.id)+'/download/nano',
            micro:'/api/users/'+req.params.username+'/photos/'+encodeURIComponent(photo.id)+'/download/micro',
            thumb:'/api/users/'+req.params.username+'/photos/'+encodeURIComponent(photo.id)+'/download/thumb',
            small:'/api/users/'+req.params.username+'/photos/'+encodeURIComponent(photo.id)+'/download/small',
            medium:'/api/users/'+req.params.username+'/photos/'+encodeURIComponent(photo.id)+'/download/medium',
            large:'/api/users/'+req.params.username+'/photos/'+encodeURIComponent(photo.id)+'/download/large'
          }
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


// Process the file upload and upload to Google Cloud Storage.
app.post('/photos', multer.single('file'), function (req, res, next) {
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