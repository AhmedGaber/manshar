'use strict';

// TODO(mkhatib): Seperate these into config/routes.js and
// config/interceptors/httpInterceptors.js and add tests for them.
// TODO(mkhatib): Move the autogenerated appConfig.js to config/constants.js.

angular.module('webClientApp', [
  'ngAnimate',
  'ngCookies',
  'ngLocale',
  'ngResource',
  'ngSanitize',
  'ui.router',
  'AppConfig',
  'truncate',
  'angulartics',
  'angulartics.google.analytics',
  'angularFileUpload',
  'angular-loading-bar',
  'ipCookie',
  'ng-token-auth',
  'monospaced.elastic'
])
  /**
   * Routing.
   */
  .config(['$stateProvider', '$locationProvider', '$urlRouterProvider',
      function ($stateProvider, $locationProvider, $urlRouterProvider) {
    // Set the default route to to to .popular child state
    $urlRouterProvider.when('/', 'articles/list/popular/');
    $stateProvider
      .state('app', {
        abstract: true,
        url: '/'
      })
      .state('app.articles', {
        abstract: true,
        url: 'articles/',
        views: {
          'content@': {
            templateUrl: 'views/main.html'
          }
        }
      })
      .state('app.articles.list', {
        url: 'list/:order/?',
        templateUrl: 'views/partials/_stream.html',
        controller: 'StreamCtrl',
        resolve: {
          articles: ['Article', '$stateParams', function(Article, $stateParams) {
            return Article.query({'order': $stateParams.order}).$promise;
          }]
        }
      })
      .state('app.articles.show', {
        url: ':articleId/?',
        views: {
          'content@': {
            templateUrl: 'views/articles/show.html',
            controller: 'ArticleCtrl'
          }
        },
        resolve: {
          article: ['Article', '$stateParams', '$state', function(Article, $stateParams, $state) {
            return Article.get({
              'articleId': $stateParams.articleId,
              'next_count': 5
            }, function(article) {
              return article;
            }, function() {
              $state.go('app');
            }).$promise;
          }]
        }
      })
      .state('app.articles.edit', {
        url: ':articleId/edit/?',
        views: {
          'content@': {
            templateUrl: 'views/articles/edit.html',
            controller: 'EditArticleCtrl'
          }
        },
        resolve: {
          user: ['$rootScope', '$auth', function($rootScope, $auth) {
            return $auth.validateUser().then(function(user) {
              return user;
            }).catch(function() {
            });
          }],
          article: ['Article', '$stateParams', '$state', 'user', function(Article, $stateParams, $state, user) {
            return Article.get({'articleId': $stateParams.articleId}, function(article) {
              if (article && article.body) {
                $state.go('app.articles.show', { articleId: article.id });
              } else if(parseInt(user.id) === parseInt(article.user.id)) {
                return article;
              } else {
                $state.go('app.articles.show', {articleId: article.id});
              }
            }).$promise;
          }]
        }
      })
      .state('app.login', {
        url: 'login/?',
        views: {
        'content@': {
            templateUrl: 'views/login.html',
            controller: 'LoginCtrl'
          }
        },
        resolve: {
          requireNoAuth: ['$auth', '$state', function($auth, $state) {
            return $auth.validateUser().then(function(user) {
              if(user) {
                $state.go('app.publishers.profile.user.published', { userId: user.id});
              }
            }, function() {
              return;
            }).$promise;
          }]
        }
      })
      .state('app.publishers', {
        url: 'publishers/?',
        views: {
          'content@': {
            templateUrl: 'views/publishers/show.html',
            controller: 'PublishersCtrl'
          }
        },
        resolve: {
          publishers: ['User', function(User) {
            return User.query().$promise;
          }]
        }
      })
      .state('app.publishers.profile', {
        abstract: true,
        url: 'profile/',
        views: {
          'content@': {
            templateUrl: 'views/profiles/show.html',
            controller: 'ProfileInitCtrl'
          }
        },
      })
      .state('app.publishers.profile.user', {
        url: ':userId/?',
        templateUrl: 'views/profiles/body.html',
        controller: 'ProfileCtrl',
        resolve: {
          profile: ['User', '$stateParams', function(User, $stateParams) {
            return User.get({'userId': $stateParams.userId}).$promise;
          }],
          publishers: ['User', '$rootScope', '$q', '$stateParams', function(User, $rootScope, $q, $stateParams) {
            // Only load publishers when coming from a non-profile state.
            if ($rootScope.previousState &&
                $rootScope.previousState.name.indexOf('app.publishers.profile') !== -1) {
              var deferred = $q.defer();
              deferred.resolve();
              return deferred.promise;
            }

            return User.query({
              'pivot_id': $stateParams.userId,
              'after_pivot_count': 10,
              'before_pivot_count': 10,
              'order_dir': 'ASC',
              'order': 'published_articles_count',
              'include_pivot': true
            }).$promise;
          }],
          articles: ['UserArticle', '$stateParams', function(UserArticle, $stateParams) {
            return UserArticle.query({'userId': $stateParams.userId}).$promise;
          }]
        }
      })
      .state('app.publishers.profile.user.edit', {
        url: 'edit/?',
        views: {
          'content@': {
            templateUrl: 'views/profiles/edit.html',
            controller: 'EditProfileCtrl'
          }
        },
        resolve: {
          canEdit: ['$auth', '$state', '$stateParams', function($auth, $state, $stateParams) {
            return $auth.validateUser().then(function(user) {
              if(parseInt(user.id) === parseInt($stateParams.userId)) {
                return;
              } else {
                $state.go('app.publishers.profile.user.published', {userId: $stateParams.userId});
              }
            }, function() {
              $state.go('app.publishers.profile.user.published', {userId: $stateParams.userId});
            });
          }]
        }
      })
      .state('app.publishers.profile.user.published', {
        url: 'published/?',
        templateUrl: 'views/profiles/stream.html',
        controller: 'ProfileCtrl'
      })
      .state('app.publishers.profile.user.drafts', {
        url: 'drafts/?',
        templateUrl: 'views/profiles/stream.html',
        controller: 'DraftCtrl',
        resolve: {
          drafts: ['$auth', '$stateParams', 'UserDraft', function($auth, $stateParams, UserDraft) {
            return $auth.validateUser().then(function(user) {
              if(user &&
                 parseInt(user.id) === parseInt($stateParams.userId)) {
                return UserDraft.query({}).$promise;
              }
            });
          }]
        }
      })
      .state('app.publishers.profile.user.stats', {
        url: 'stats/?',
        templateUrl: 'views/profiles/stats.html',
        controller: 'StatCtrl',
        resolve: {
          stats: ['$auth', '$stateParams', 'ArticleStats', function($auth, $stateParams, ArticleStats) {
            return $auth.validateUser().then(function(user) {
              if(user && parseInt(user.id) === parseInt($stateParams.userId)) {
                return ArticleStats.query({}).$promise;
              }
            });
          }]
        }
      })
      .state('app.publishers.profile.user.recommended', {
        url: 'recommended/?',
        templateUrl: 'views/profiles/stream.html',
        controller: 'RecommendationCtrl',
        resolve: {
          recommendations: ['UserRecommendation', '$stateParams', function(UserRecommendation, $stateParams) {
            return UserRecommendation.query({'userId': $stateParams.userId}).$promise;
          }]
        }
      })
      .state('app.publishers.profile.user.discussions', {
        url: 'discussions/?',
        templateUrl: 'views/profiles/stream.html',
        controller: 'DiscussionCtrl',
        resolve: {
          comments: ['UserComment', '$stateParams', function(UserComment, $stateParams) {
            return UserComment.query({'userId': $stateParams.userId}).$promise;
          }]
        }
      })
      .state('app.categories', {
        abstract: true,
        url: 'categories/:categoryId/',
      })
      .state('app.categories.articles', {
        abstract: true,
        url: 'articles/',
        views: {
          'content@': {
            templateUrl: 'views/categories/show.html',
            controller: 'CategoryCtrl'
          }
        },
        resolve: {
          category: ['Category', '$stateParams', '$state', function(Category, $stateParams, $state) {
            return Category.get({'categoryId': $stateParams.categoryId}, function(category) {
              return category;
            }, function() {
              $state.go('app');
            });
          }],
          topics: ['Topic', '$stateParams', function(Topic, $stateParams) {
            return Topic.query({'categoryId': $stateParams.categoryId}).$promise;
          }]
        }
      })
      .state('app.categories.articles.list', {
        url: ':order/?',
        templateUrl: 'views/partials/_stream.html',
        controller: 'StreamCtrl',
        resolve: {
          articles: ['CategoryArticle', '$stateParams', function(CategoryArticle, $stateParams) {
            return CategoryArticle.query({
              'categoryId': $stateParams.categoryId,
              'order': $stateParams.order
            }).$promise;
          }]
        }
      })
      .state('app.categories.topic', {})
      .state('app.categories.topic.articles', {
        url: 'topics/:topicId/articles/',
        abstract: true,
        views: {
          'content@': {
            templateUrl: 'views/topics/show.html',
            controller: 'TopicCtrl'
          }
        },
        resolve: {
          topic: ['Topic', '$state', '$stateParams', function(Topic, $state, $stateParams) {
            return Topic.get({
                  'categoryId': $stateParams.categoryId,
                  'topicId': $stateParams.topicId
                }, function(topic) {
                  return topic;
                }, function() {
                  $state.go('app');
                }).$promise;
          }]
        }
      })
      .state('app.categories.topic.articles.list', {
        url: ':order/?',
        templateUrl: 'views/partials/_stream.html',
        controller: 'StreamCtrl',
        resolve: {
          articles: ['TopicArticle', '$state', '$stateParams', function(TopicArticle, $state, $stateParams) {
            return TopicArticle.query({
                    'categoryId': $stateParams.categoryId,
                    'topicId': $stateParams.topicId,
                    'order': $stateParams.order
                  }, function(articles) {
                    return articles;
                  }, function() {
                    $state.go('app');
                  }).$promise;
          }]
        }
      })
      .state('app.signup', {
        url: 'signup/?',
        views: {
        'content@': {
            templateUrl: 'views/signup.html',
            controller: 'SignupCtrl'
          }
        },
        resolve: {
          requireNoAuth: ['$auth', '$state', function($auth, $state) {
            return $auth.validateUser().then(function(user) {
              if(user) {
                $state.go('app.publishers.profile.user.published', { userId: user.id});
              }
            }, function() {
              return;
            }).$promise;
          }]
        }
      })
      .state('app.reset', {
        url: 'accounts/reset_password/?',
        views: {
        'content@': {
            templateUrl: 'views/accounts/reset_password.html',
            controller: 'ResetPasswordController'
          }
        },
        resolve: {
          requireNoAuth: ['$auth', '$state', function($auth, $state) {
            return $auth.validateUser().then(function(user) {
              if(user) {
                $state.go('app.publishers.profile.user.published', { userId: user.id});
              }
            }, function() {
              return;
            }).$promise;
          }]
        }
      })
      .state('app.admin', {
        url: 'admin/?',
        views: {
        'content@': {
            templateUrl: 'views/admin/dashboard.html'
          }
        },
        resolve: {
          user: ['$auth', '$state', function($auth, $state) {
            return $auth.validateUser().then(function(user) {
              if(user.role === 'admin') {
                return user;
              } else {
                $state.go('app');
              }
            }, function() {
                $state.go('app');
            }).$promise;
          }]
        }
      })
      .state('app.admin.categories', {
        url: 'manage/categories/?',
        views: {
        'content@': {
            templateUrl: 'views/admin/manage/categories.html',
            controller: 'ManageCategoriesCtrl'
          }
        }
      })
      .state('app.redirects', {})
      .state('app.redirects.profiles', {
        url: 'profiles/:userId/?',
        onEnter: function ($state, $stateParams) {
          $state.transitionTo('app.publishers.profile.user.published', {
            userId: $stateParams.userId
          });
        }
      })
      .state('app.redirects.categories', {
        url: 'categories/:categoryId/?',
        onEnter: function ($state, $stateParams) {
          $state.transitionTo('app.categories.articles.list', {
            categoryId: $stateParams.categoryId,
            order: 'popular'
          });
        }
      })
      .state('app.redirects.topics', {
        url: 'categories/:categoryId/topics/:topicId/?',
        onEnter: function ($state, $stateParams) {
          $state.transitionTo('app.categories.topic.articles.list', {
            categoryId: $stateParams.categoryId,
            topicId: $stateParams.topicId,
            order: 'popular'
          });
        }
      })
      ;
  }])
  .factory('unAuthenticatedInterceptor', ['$location', '$q', '$rootScope',
      function ($location, $q, $rootScope) {
    return {
      'request': function(config) {
        return config;
      },

      'requestError': function(response) {
        console.error(response);
      },

      'response': function(response) {
        return response;
      },

      'responseError': function(response) {
        if (response.status === 401) {
          var previous = $location.path();
          $rootScope.$broadcast('showLoginDialog', {'prev': previous});
          return $q.reject(response);
        }
        else {
          return $q.reject(response);
        }
      }
    };
  }])

  /**
   * Sets up authentication for ng-token-auth.
   */
  .config(['$authProvider', 'API_HOST', function($authProvider, API_HOST) {
    $authProvider.configure({
      apiUrl: '//' + API_HOST,
      omniauthWindowType: 'newWindow',
      confirmationSuccessUrl:  '//' + window.location.host + '/login',
      passwordResetSuccessUrl: ('//' + window.location.host +
                                '/accounts/update_password'),
      authProviderPaths: {
        facebook: '/auth/facebook',
        gplus:   '/auth/gplus'
      },
    });
  }])

  /**
   * Intercept every http request and check for 401 Unauthorized
   * error. Clear the current user and redirect to /login page.
   */
  .config(['$httpProvider', '$locationProvider', function ($httpProvider, $locationProvider) {
    $httpProvider.interceptors.push('unAuthenticatedInterceptor');
    $locationProvider.html5Mode(true).hashPrefix('!');
  }])
  /**
   * Allow embedding specific sites.
   */
  .config(['$sceDelegateProvider', function ($sceDelegateProvider) {
    $sceDelegateProvider.resourceUrlWhitelist([
      // Allow same origin resource loads.
      'self',
      // Allow loading from YouTube domain.
      'http://www.youtube.com/embed/**',
      'https://www.youtube.com/embed/**'
    ]);
  }])
  /**
   * Disable the spinner for angular-loading-bar.
   */
  .config(['cfpLoadingBarProvider', function(cfpLoadingBarProvider) {
    cfpLoadingBarProvider.includeSpinner = false;
  }])
  /**
   * Disable automatic page collection. We do our own pageviews analytics
   * collection to allow for page titles collection.
   */
  .config(['$analyticsProvider', function($analyticsProvider) {
    $analyticsProvider.virtualPageviews(false);
  }])
  /**
   * Everytime the route change check if the user need to login.
   */
  .run(['$location', '$rootScope', '$analytics', 'Category', 'GA_TRACKING_ID', 'Article', '$state', '$timeout',
      function ($location, $rootScope, $analytics, Category, GA_TRACKING_ID, Article, $state, $timeout) {

    // ga is the Google analytics global variable.
    if (window.ga) {
      ga('create', GA_TRACKING_ID);
    }

    $rootScope.linkPrefix = '//' + document.location.host;

    /**
     * Holds data about page-wide attributes. Like pages title.
     */
    $rootScope.page = {
      title: 'منصة النشر العربية',
      description: 'منصة نشر متخصصة باللغة العربية مفتوحة المصدر',
      image: '//' + document.location.host + '/images/manshar@200x200.png'
    };

    /**
     * Load categories once for all application
     */
    $rootScope.categories = Category.query();

    /**
     * Create new article
     */
    $rootScope.createNewArticle = function() {
      Article.save({
        article: { published: false }
      }, function(resource) {
        $analytics.eventTrack('Article Created', {
          category: 'Article'
        });
        $state.go('app.articles.edit', { articleId: resource.id });
      }, function(response) {
        $analytics.eventTrack('Article Create Error', {
          category: 'Article',
          label: angular.toJson(response.errors)
        });

        $state.go('app');
      });
    };


    /**
     * Shows the login dialog.
     * @param {string} optPrev Optional previous path to go back to after login.
     */
    $rootScope.showLoginDialog = function(optPrev) {
      $rootScope.$broadcast('showLoginDialog', {
        'prev': optPrev
      });
    };

    /**
     * Returns true if the passed user is the same user that is referenced
     * in the resource. This assumes that the resource always have a user
     * property, otherwise it'll return false.
     * @param {Object} user The object representing the user data.
     * @param {Object} resource The object representing the resource (e.g. Article).
     * @returns {boolean} true if the user is the owner of the resource.
     */
    $rootScope.isOwner = function (user, resource) {
      var id = user && parseInt(user.id);
      return (!!user && !!resource && !!resource.user &&
              id === resource.user.id);
    };

    $rootScope.$on('$stateChangeStart', function(
          event, toState, toParams, fromState, fromParams) {
      /* jshint unused:false */
      $rootScope.previousState = fromState;
    });

    $rootScope.$on('$stateChangeSuccess', function() {
      $timeout(function() {
        ga('send', 'pageview', {'page': $location.path()});
      }, 200);
    });

  }]);
