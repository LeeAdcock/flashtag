var app = angular.module('flashTag');

app.controller('photoSummaryController', ['$scope', 'tagService', 'photoService', '$location',
    function($scope, tagService, photoService, $location) {
    
    photoService.getPhotos().then(function(data) {
        console.log(data);
        $scope.photos = data.photos;
    });
    
    return {
        photoDetails: function(photo) {
            $location.path("/photos/"+photo.id);
        }
    };
        
}]);