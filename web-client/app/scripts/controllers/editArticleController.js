'use strict';
/* jshint camelcase: false */

angular.module('webClientApp')
  .controller('EditArticleCtrl', ['$rootScope', '$scope', '$stateParams', '$state', '$analytics', '$window', '$interval', '$timeout', '$anchorScroll', 'Article', 'article',
      function ($rootScope, $scope, $stateParams, $state, $analytics, $window, $interval, $timeout, $anchorScroll, Article, article) {

    console.log('i am a controller');
    var confirmEditMessage = ('هذه العملية ستنقل المقال إلى مسوداتك. يمكنك' +
        ' نشرها مجدداً بالضغط على نشر. هل تود نقل المقال للمسودات؟');

    var lastSavedArticle = {};
    // Load the article if we are editing.
    lastSavedArticle = angular.copy(article);
    $scope.article = article;
    console.log('article', article);
    /**
     * Checks if the article has been changed since the last time it was saved.
     * @return {boolean} True if the article has been changed.
     */
    var isDirty = function () {
      var maybeUpdatedArticle = angular.copy($scope.article);
      var attrs = ['body', 'json_model', 'cover_url', 'tagline', 'title', 'topic'];
      for (var i = 0; i < attrs.length; i++) {
        if (!angular.equals(
            maybeUpdatedArticle[attrs[i]], lastSavedArticle[attrs[i]])) {
          return true;
        }
      }
      return false;
    };

    // Update the page title when the title of the article changes.
    $scope.$watch('article.title', function(){
      $rootScope.page.title = $scope.article.title || 'مقال جديد';
    });

    // Warn the user that editing an article will move it to draft until
    // they publish it again.
    $timeout(function () {
      if (article.published) {
        if (!$window.confirm(confirmEditMessage)) {
          $state.go('app.articles.show', {articleId: article.id});
        } else {
          $scope.article.published = false;
        }
      }
      $anchorScroll();
    });

    var updateSuccess = function (resource) {
      console.log('resouce', resource);
      lastSavedArticle = angular.copy(resource);
      $timeout(function () {
        $scope.isSaving = false;
      }, 1000);
      $scope.inProgress = null;

      if (resource.published) {
        // First time this gets published.
        if (!$scope.article.published_at) {
          $scope.article.published_at = resource.published_at;
          $scope.article.topic = resource.topic;
          $analytics.eventTrack('New Article Published', {
            category: 'Article',
            label: resource.title
          });
        } else {
          // The article has been already published, moved to draft and now
          // republished again.
          $analytics.eventTrack('Article Re-Published', {
            category: 'Article',
            label: resource.title
          });
        }
      }
      if (resource.published) {
        $state.go('app.articles.show', {articleId: resource.id});
      }
    };

    var updateError = function (response) {
      $scope.inProgress = null;
      $analytics.eventTrack('Article Update Error', {
        category: 'Article',
        label: angular.toJson(response.errors)
      });
      $scope.error = 'حدث خطأ في حفظ المقال.';
    };

    var deleteSuccess = function () {
      $analytics.eventTrack('Article Deleted', {
        category: 'Article'
      });
      $state.go('app.publishers.profile.published', {userId: $rootScope.user.id});
    };

    var deleteError = function (response) {
      $scope.inProgress = null;
      $analytics.eventTrack('Delete Article Error', {
        category: 'Article',
        label: angular.toJson(response.errors)
      });
      $scope.error = 'حدث خطأ في حذف المقال.';
    };

    var publishingAfterTopicPicked = false;
    /**
     * Saves/Updates article data.
     * @param {Object} article Article data.
     * @param {boolean} published Whether to publish the article or save as a draft.
     * @param {boolean} silent Whether to flash the controls or not.
     */
    $scope.saveArticle = function(article, published, silent) {
      console.log('saving...');
      // Clear autosave interval before sitting published.
      if(autoSavePromise && published) {
        $interval.cancel(autoSavePromise);
      }
      article.published = published;
      var formError = $scope.articleForm.$error;
      if(published && formError && formError.required) {
        $window.alert('تأكد من ادخال جميع المعلومات المطلوبة');
        return;
      }

      // First time publishing article.
      if (published && !article.published_at && !article.topic) {
        publishingAfterTopicPicked = published;
        $rootScope.$emit('openTopicPicker', {allowCreateTopics: true});
      } else {
        if (!silent) {
          $scope.inProgress = published ? 'publish' : 'save';
        }

        Article.update(
            { 'articleId': article.id }, { article: article },
            updateSuccess, updateError, {ignoreLoadingBar: !published});
      }
    };

    /**
     * Deletes an article.
     * @param {Object} article Article data.
     */
    $scope.deleteArticle = function(article) {
      $scope.inProgress = 'delete';
      if ($window.confirm('متأكد من حذف المقال؟')) {
        Article.delete({ 'articleId': article.id }, {}, deleteSuccess, deleteError);
      } else {
        $scope.inProgress = null;
      }
    };

    /**
     * Cancel creating an article.
     */
    $scope.cancel = function() {
      $scope.inProgress = 'cancel';
      // Warn the user when canceling editing an existing article or when
      // canceling a new article with changed properties.
      if (!isDirty() || $window.confirm('متأكد من إلغاء المقال؟')) {
        $state.go('app');
      } else {
        $scope.inProgress = null;
      }
    };

    /**
     * Extracts title, snippet and HTML body from the editor when changed.
     * @param  {carbonEditor} editor A carbon editor instance.
     */
    $scope.onChange = function(editor) {
      $scope.article.title = editor.getTitle();
      $scope.article.body = editor.getHTML();
      var snippet = editor.getSnippet();
      if (snippet) {
        var words = snippet.split(' ');
        words = words.slice(0, 35);
        $scope.article.tagline = words.join(' ') + '...';
      }
    };

    $scope.changeTopic = function() {
      $rootScope.$emit('openTopicPicker', {allowCreateTopics: true});
    };

    /**
     * Start the auto save interval and save its promise to destroy it when the
     * user is done editing.
     * @return {!angular.$promise} A promise to be notified on each iteration.
     */
    var autoSavePromise = $interval(function () {
      if (!isDirty()) {
        return;
      }

      $scope.isSaving = true;
      $scope.saveArticle($scope.article, false, true);
    }, 5000);


    var topicSelectedUnbind = $rootScope.$on('topicSelected', function(event, data) {
      if (data.topic && data.topic.id) {
        $scope.article.topic = data.topic;
        $scope.article.topic_id = data.topic.id;
        $scope.article.category = data.topic.category;
        $scope.article.category_id = data.topic.category.id;
      }
      $scope.article.published_at = publishingAfterTopicPicked;
      $scope.saveArticle($scope.article, publishingAfterTopicPicked);
    });

    /**
     * When the user logout while in edit mode redirect the user,
     */
    var loggedOutUnbined = $rootScope.$on('auth:logout-success', function () {
      if ($scope.article.published) {
        $state.go('app.articles.show', {articleId: $stateParams.articleId});
      } else {
        $state.go('app');
      }
    });

    /**
     * Make sure to cleanup the binded events and intervals when the user
     * leaves to another controller.
     */
    var onDestroy = function () {
      $interval.cancel(autoSavePromise);
      loggedOutUnbined();
      topicSelectedUnbind();
    };

    // Make sure to cleanup the binding. Otherwise the event listener will
    // be added everytime the controller load and when the controller is
    // still loaded it would still listen to the event.
    $scope.$on('$destroy', onDestroy);

  }]);
