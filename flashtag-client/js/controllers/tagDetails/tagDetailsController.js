var app = angular.module('flashTag');

app.controller('tagDetailsController', ['$scope', 'tagService', 'photoService', '$routeParams', function($scope, tagService, photoService, $routeParams) {
    
    tagService.getTag($routeParams.tag).then(function(tag) {
        console.log('tag', tag);
        $scope.tag = tag;

        tagService.getPhotosForTag($routeParams.tag).then(function(photos) {
            console.log('photos', photos);
            $scope.photos = photos;
        });
    
        // precache
        tag.similar.forEach(function(similarTag) {
            var similarTagDetails = tagService.getTag(similarTag.tag);
            console.log('similartag', similarTagDetails);
        })
        
    });

}]);