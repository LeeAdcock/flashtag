var app = angular.module('flashTag');

app.controller('photoDetailsController', ['$scope', 'photoService', 'tagService','$routeParams', '$location',
    function($scope, photoService, tagService, $routeParams, $location) {

    photoService.getPhotoDetails($routeParams.photo).then(function(photo) {
        console.log('photo', photo);
        $scope.photo = photo;
    });
    
}]);