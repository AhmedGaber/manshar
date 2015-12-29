'use strict';

angular.module('webClientApp')
.directive('loadMoreData', ['$document', '$rootScope', '$state', 'User', 'Article', 'TopicArticle', 'CategoryArticle', 'UserArticle', 'UserRecommendation', 'UserComment', 'UserDraft',
  function ($document, $rootScope, $state, User, Article, TopicArticle, CategoryArticle, UserArticle, UserRecommendation, UserComment, UserDraft) {

    // Pass order and category id
  	return {
      restrict: 'E',
      scope: {
        order: '=',
        category: '=',
        topic: '=',
        appendTo: '=',
        profile: '=',
        state: '='
      },
      link: function(scope, element) {
        var page = 1;
        scope.hasNext = true;

        var scrollWatch = $rootScope.$watch('yscroll', function(newValue, oldValue) {
          var scrollHeight = element[0].parentElement.scrollHeight;
          if( !scope.inProgress && scrollHeight-newValue <= 1000) {
            scope.loadMoreData();
          }
        });
        scope.$on('$destroy', function() {
          scrollWatch();
        });
        // Success callback for querying articles. Appends retrieved articles.
        var addData = function(data) {
          if (!data || !data.length) {
            scope.hasNext = false;
            scrollWatch();
          }
          Array.prototype.push.apply(scope.appendTo, data);
          scope.inProgress = null;
        };

        var loadedArticles = {};

        var loopAddArticles = function(articles) {
          if (!articles || !articles.length) {
            scope.hasNext = false;
            scrollWatch();
          }
          for(var i = 0; i < articles.length; ++i) {
            var article = articles[i].article;
            if(!loadedArticles[article.id]) {
              scope.appendTo.push(article);
              loadedArticles[article.id] = true;
            }
          }
          scope.inProgress = null;
        };

        scope.loadMoreData = function() {
          scope.inProgress = true;
          if(scope.state == 'publishers') {
            User.query({
              'page': ++page
            }, addData);
          } else if(scope.topic) {
            TopicArticle.query({
              'categoryId': scope.topic.category.id,
              'topicId': scope.topic.id,
              'page': ++page
            }, addData);
          } else if(scope.category) {
            CategoryArticle.query({
              'categoryId': scope.category.id,
              'page': ++page
            }, addData);
          } else if(scope.profile) {
            if(scope.state === 'published') {
              UserArticle.query({
                'userId': scope.profile.id,
                'page': ++page
              }, addData);
            } else if(scope.state === 'recommended') {
              UserRecommendation.query({
                'userId': scope.profile.id,
                'page': ++page
              }, loopAddArticles);
            } else if(scope.state === 'discussions') {
              UserComment.query({
                'userId': scope.profile.id,
                'page': ++page
              }, loopAddArticles);
            } else if(scope.state === 'drafts') {
              UserDraft.query({
                'userId': scope.profile.id,
                'page': ++page
              }, addData);
            }
          } else if(scope.order) {
            Article.query({
              'order': scope.order,
              'page': ++page
            }, addData);
          }
        };

      },
      template: '<div class="more-articles section">'+
                  '<h3 class="section-title" ng-click="loadMoreData()"'+
                    'ng-show="hasNext">'+
                    '<i class="circle-icon fa fa-refresh"></i>'+
                  '</h3>'+
                '</div>'
    };
  }]);
