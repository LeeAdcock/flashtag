'use strict';

// Declare app level module which depends on views, and components
var app = angular.module('myApp', ['ngRoute','angularFileUpload']);

app.controller('flashtag', ['$scope', 'FileUploader', function($scope, FileUploader) {
    
    $scope.imageTags = {};

    var uploader = $scope.uploader = new FileUploader({
        url: '/photo'
    });

    uploader.filters.push({
        name: 'customFilter',
        fn: function(item /*{File|FileLikeObject}*/, options) {
            return this.queue.length < 10;
        }
    });

    uploader.filters.push({
        name: 'imageFilter',
        fn: function(item /*{File|FileLikeObject}*/, options) {
            var type = '|' + item.type.slice(item.type.lastIndexOf('/') + 1) + '|';
            return '|jpg|png|jpeg|bmp|gif|'.indexOf(type) !== -1;
        }
    });
            
    uploader.onAfterAddingFile = function(fileItem) {
        fileItem.upload();
    };

    uploader.onBeforeUploadItem = function(item) {
        $scope.processing = true;
    };

    uploader.onSuccessItem = function(fileItem, response, status, headers) {
        var toLowerCase = function(val) {
            return val.replace(' ','').toLowerCase();
        }

        var fileTags = [];
        ['labels', 'text', 'landmarks'].forEach(function(category) {
            fileTags = fileTags.concat(response[category].map(toLowerCase));
            
        });
        fileTags.forEach(function(tag) {
            $scope.imageTags[tag] = $scope.imageTags[tag] ? $scope.imageTags[tag]+1 : 1; 
        });
        
        $scope.processing = false;
    };

}]);