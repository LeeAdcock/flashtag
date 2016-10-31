var app = angular.module('flashTag');

app.directive('background', function(){
    return function(scope, element, attrs){
        var url = attrs.background;
        element.css({
            'background-color': 'gray',
            'background': 'url(' + url +')',
            'background-size' : 'cover'
        });
    };
});