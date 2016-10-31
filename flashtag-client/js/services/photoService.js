var app = angular.module('flashTag');
app.factory('photoService', function($q, $http, userService) {

  var photoListCache;

  return {

    getPhotos: function() {
      var defer = $q.defer();
      if(photoListCache==undefined) {
        userService.getUser().then(function(user) {
          $http({
            method: 'GET',
            url: user.ref.photos
          }).then(function(response) {
            defer.resolve(photoListCache = response.data);
          }, function(response) {
            defer.reject();
          })
        })
      } else {
        defer.resolve(photoListCache);
      }
      return defer.promise;
    },

    getPhotoDetails: function(photo) {
      var defer = $q.defer();
      if(typeof photo == 'string') {
        // only have the photo id, so assemble the url
        userService.getUser().then(function(user) {
          $http({
            method: 'GET',
            url: user.ref.photos+'/'+photo
          }).then(function(response) {
            defer.resolve(response.data);
          }, function(response) {
            defer.reject();
          })
        })
      } else {
        // have the photo obj, so get the details url
        $http({
          method: 'GET',
          url: photo.ref.details
        }).then(function(response) {
          defer.resolve(response.data);
        }, function(response) {
          defer.reject();
        })
      }
      return defer.promise;
    }
    
  };});