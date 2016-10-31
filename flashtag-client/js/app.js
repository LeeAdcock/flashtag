'use strict';
/* global angular */

// Declare app level module which depends on views, and components
var app = angular.module('flashTag', ['ngRoute']);

app.config(function($locationProvider, $routeProvider) {

    $routeProvider
        .when("/search", {
            controller: "searchController",
            controllerAs: "controller",
            templateUrl: "/js/controllers/search/template.html"
        })
        .when("/photos", {
            controller: "photoSummaryController",
            controllerAs: "controller",
            templateUrl: "/js/controllers/photoSummary/template.html"
        })
        .when("/photos/:photo", {
            controller: "photoDetailsController",
            controllerAs: "controller",
            templateUrl: "/js/controllers/photoDetails/template.html"
        })
        .when("/tags", {
            controller: "tagSummaryController",
            controllerAs: "controller",
            templateUrl: "/js/controllers/tagSummary/template.html"
        })
        .when("/tags/:tag", {
            controller: "tagDetailsController",
            controllerAs: "controller",
            templateUrl: "/js/controllers/tagDetails/template.html"
        });
});
