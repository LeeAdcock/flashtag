var app = angular.module('flashTag');
app.factory('userService', function($q, $http) {

  var username = 'katieandlee';
  var userDetailsCache;

  return {
    getUser: function() {
      var defer = $q.defer();
      if(userDetailsCache) {
        defer.resolve(userDetailsCache);
      } else {
        $http({
          method: 'GET',
          url: '/api/users/'+username
        }).then(function(response) {
          console.log('user', response.data);
          defer.resolve(userDetailsCache=response.data);
        }, function(response) {
          defer.reject();
        })
      }
      return defer.promise;
    }
      
  };
});