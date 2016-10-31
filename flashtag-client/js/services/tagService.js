var app = angular.module('flashTag');
app.factory('tagService', function($http, $q, userService) {

  var tagDetailsCache = {};
  var tagPhotosCache = {};

  return {

    getTags: function() {
      var defer = $q.defer();
      userService.getUser().then(function(user) {
        $http({
          method: 'GET',
          url: user.ref.tags
        }).then(function(response) {
          defer.resolve(response.data);
        }, function(response) {
          defer.reject();
        })
      });
      return defer.promise;
    },

    getTag: function(tag) {
      var defer = $q.defer();
      
      if(tagDetailsCache[tag]) {
        defer.resolve(tagDetailsCache[tag])
      } else {
        // only have the photo id, so assemble the url
        userService.getUser().then(function(user) {
          $http({
            method: 'GET',
            url: user.ref.tags+'/'+tag
          }).then(function(response) {
            defer.resolve(tagDetailsCache[tag] = response.data);
          }, function(response) {
            defer.reject();
          })
        })
      }
      return defer.promise;
    },
    
    getPhotosForTag: function(tag) {
      var defer = $q.defer();
      if(tagPhotosCache[tag]) {
        defer.resolve(tagPhotosCache[tag])
      } else {
        userService.getUser().then(function(user) {
          $http({
            method: 'GET',
            url: user.ref.tags+'/'+tag+'/photos'
          }).then(function(response) {
            defer.resolve(tagPhotosCache[tag] = response.data);
          }, function(response) {
            defer.reject();
          })
        })
      }
      return defer.promise;
    }

    
  };
});