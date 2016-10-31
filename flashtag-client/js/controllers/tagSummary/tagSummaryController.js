var app = angular.module('flashTag');

app.controller('tagSummaryController', ['$scope', 'tagService', 'photoService', function($scope, tagService, photoService) {
    
    tagService.getTags().then(function(data) {
        $scope.tags = data.tags.sort(function(a, b) {return b.count-a.count});
    });
    
    $scope.expandTag = function(tag) {
        tagService.getTagDetails(tag).then(function(data) {
            console.log(data);
        });

    }

}]);