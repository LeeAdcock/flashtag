var app = angular.module('flashTag');

app.controller('searchController', ['$scope', 'searchService', 'photoService', '$routeParams', '$location',
    function($scope, searchService, photoService, $routeParams, $location) {

        var results;
        var selectedPhoto;
        var controller = this;

        var search = function(tags) {
            console.log('search for',tags);
            if(tags.length>0) {
                controller.searchTags=angular.isArray(tags) ? tags : tags.split(',');
                controller.searchString = controller.searchTags.join(' ');
                $location.path('/search').search({tags: controller.searchTags});
                return searchService.search(controller.searchTags);
            } else {
                photoService.getPhotos().then(function(photos) {
                    return {
                        then: function(photos) {
                            ({
                                photos: photos.photos
                            });
                        }
                    };
                });
            }
            
        }

        controller.select = function(photo) {
            console.log('select', photo);
            selectedPhoto = photo;
            $('#photoDetails').modal({});
        }

        controller.getSelected = function() {
            return selectedPhoto;
        }

        controller.init = function() {
            search($routeParams.tags).then(function(searchResults) {
                results = searchResults;
                console.log('results', results);
            });
        }
        
        controller.updateSearch = function(tags) {
            controller.searchTags=angular.isArray(tags) ? tags : tags.split(/\s{1,}/);
            $location.path('/search').search({tags: controller.searchTags});
        }
        
        controller.addToSearch =  function(tag) {
            controller.searchTags = controller.searchTags.concat([tag.name]).join();
            $location.path('/search').search({tags: controller.searchTags});
        }
        
        controller.removeFromSearch = function(tag) {
            controller.searchTags.splice(controller.searchTags.indexOf(tag.name),1);
            $location.path('/search').search({tags: controller.searchTags});
        }
        
        controller.getResults = function() {
            return results;
        }
    }
]);