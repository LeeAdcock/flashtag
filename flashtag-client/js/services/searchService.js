var app = angular.module('flashTag');
app.factory('searchService', function($q, $http, userService) {

  return {

    search: function(tags) {
      var defer = $q.defer();
      userService.getUser().then(function(user) {
        $http({
          method: 'GET',
          url: user.ref.search+'?tags='+tags.join()
        }).then(function(response) {
          defer.resolve(response.data);
        }, function(response) {
          defer.reject();
        })
      })
      return defer.promise;
    },

  };});