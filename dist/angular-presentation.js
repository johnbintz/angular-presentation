(function() {
  var codeGrabber, presentation, processCodeBlock;

  presentation = angular.module('presentation', ['ui.keypress']);

  presentation.factory('boundScopeHelper', function() {
    return function(directive) {
      var originalCompile, originalLink;
      originalCompile = directive.compile;
      originalLink = directive.link;
      directive.compile = function(tE, tA, transclude) {
        var key, value, _ref;
        _ref = directive.scope;
        for (key in _ref) {
          value = _ref[key];
          tA[key] = key;
        }
        if (originalCompile != null) {
          return originalCompile(tE, tA, transclude);
        } else if (originalLink) {
          return originalLink;
        } else {
          return function(scope, element, attrs) {};
        }
      };
      delete directive.link;
      return directive;
    };
  });

  presentation.factory('presentationOptions', function() {
    var Options;
    Options = (function() {
      function Options() {}

      Options.prototype.slides = [];

      Options.prototype.currentSlide = null;

      Options.prototype.addSlide = function(id) {
        this.slides.push(id);
        return this.currentSlide || (this.currentSlide = id);
      };

      Options.prototype.currentSlideIndex = function() {
        return this.slides.indexOf(this.currentSlide);
      };

      Options.prototype.nextSlide = function() {
        var index;
        index = this.currentSlideIndex() + 1;
        if (index < this.slides.length) {
          return this.switchToSlide(index);
        }
      };

      Options.prototype.previousSlide = function() {
        var index;
        index = this.currentSlideIndex() - 1;
        if (index > -1) {
          return this.switchToSlide(index);
        }
      };

      Options.prototype.switchToSlide = function(index) {
        return this.currentSlide = this.slides[index];
      };

      Options.prototype.hasPrevious = function() {
        return this.currentSlideIndex() > 0;
      };

      Options.prototype.hasNext = function() {
        return this.currentSlideIndex() < this.slides.length - 1;
      };

      Options.prototype.nextID = function() {
        return "slide-" + this.slides.length;
      };

      return Options;

    })();
    return new Options();
  });

  presentation.directive('presentation', function() {
    return {
      restrict: 'E',
      transclude: true,
      replace: true,
      templateUrl: 'presentation.html',
      controller: function($scope, presentationOptions) {
        return $scope.options = presentationOptions;
      }
    };
  });

  presentation.directive('slide', function(boundScopeHelper) {
    return boundScopeHelper({
      restrict: 'E',
      replace: true,
      transclude: true,
      templateUrl: 'slide.html',
      scope: {
        'options': '='
      },
      compile: function(tE, tA, transclude) {
        var id;
        id = tA.id;
        return function(scope, element, attrs) {
          scope.id = id || scope.options.nextID();
          scope.options.addSlide(scope.id);
          scope.state || (scope.state = {});
          return scope.codeBlocks || (scope.codeBlocks = {});
        };
      }
    });
  });

  presentation.simpleDirective = function(name, options) {
    if (options == null) {
      options = {};
    }
    return this.directive(name, function($sce) {
      return {
        restrict: 'E',
        replace: true,
        transclude: true,
        scope: true,
        templateUrl: name + '.html',
        compile: function(tE, tA, transclude) {
          return function(scope, element, attrs) {
            return transclude(scope, function(clone, innerScope) {
              clone = angular.element('<div />').append(clone);
              if (options.postLink != null) {
                options.postLink(scope, name, clone);
                return scope[name] = $sce.trustAsHtml(scope[name]);
              }
            });
          };
        }
      };
    });
  };

  presentation.simpleDirective('title', {
    postLink: function(scope, name, clone) {
      return scope[name] = clone.text();
    }
  });

  presentation.simpleDirective('subtitle', {
    postLink: function(scope, name, clone) {
      return scope[name] = clone.html();
    }
  });

  presentation.directive('controls', function() {
    return {
      restrict: 'E',
      replace: true,
      templateUrl: 'controls.html'
    };
  });

  codeGrabber = function(scope, element, name) {
    var html;
    html = element.html();
    scope.codeBlocks || (scope.codeBlocks = {});
    return scope.codeBlocks[name] = html;
  };

  presentation.directive('script', function() {
    return {
      restrict: 'E',
      link: function(scope, element, attrs) {
        if (attrs.type === 'text/code-grabber') {
          return codeGrabber(scope, element, attrs["for"]);
        }
      }
    };
  });

  presentation.directive('codeGrabber', function() {
    return {
      restrict: 'A',
      link: function(scope, element, attrs) {
        return codeGrabber(scope, element, attrs.codeGrabber);
      }
    };
  });

  presentation.directive('codeRunner', function($compile) {
    return {
      restrict: 'E',
      replace: true,
      link: function(scope, element, attrs) {
        var target;
        element.after("<div class='code-runner' />");
        target = element.next();
        element.remove();
        return scope.$watch('codeBlocks', function(codeBlocks) {
          var content;
          content = angular.element("<div />").append(codeBlocks[attrs["for"]]);
          $compile(content)(scope);
          target.html('');
          return target.append(content);
        }, true);
      }
    };
  });

  processCodeBlock = function(code, language, callback) {
    var beautifier, length, line, lines, output, prismLanguage;
    prismLanguage = null;
    beautifier = (function() {
      switch (language) {
        case 'html':
          prismLanguage = 'markup';
          return window.html_beautify;
        case 'javascript':
        case 'json':
          prismLanguage = 'javascript';
          return window.js_beautify;
        case 'css':
        case 'scss':
        case 'sass':
          prismLanguage = 'css';
          return window.css_beautify;
        default:
          prismLanguage = language;
          return function(code, options) {
            return code;
          };
      }
    })();
    output = beautifier(code, {
      indent_size: 2
    }).replace(/</g, "&lt;");
    lines = output.split("\n");
    length = lines[0].length - lines[0].replace(/^ */, '').length;
    output = ((function() {
      var _i, _len, _results;
      _results = [];
      for (_i = 0, _len = lines.length; _i < _len; _i++) {
        line = lines[_i];
        _results.push(line.substr(length));
      }
      return _results;
    })()).join("\n");
    return callback(Prism.highlight(output, Prism.languages[prismLanguage]));
  };

  presentation.directive('codeDisplayer', function(boundScopeHelper) {
    return boundScopeHelper({
      restrict: 'E',
      replace: true,
      scope: {
        codeBlocks: '=',
        state: '='
      },
      templateUrl: 'code_displayer.html',
      link: function(scope, element, attrs) {
        return scope.$watch('codeBlocks', function(codeBlocks) {
          if (codeBlocks && codeBlocks[attrs["for"]]) {
            return processCodeBlock(codeBlocks[attrs["for"]], attrs.language, function(highlightedCode) {
              return element.find('code').append(highlightedCode);
            });
          }
        }, true);
      }
    });
  });

  presentation.directive('pre', function() {
    return {
      restrict: 'E',
      link: function(scope, element, attrs) {
        if (attrs.language != null) {
          return processCodeBlock(element.text(), attrs.language, function(highlightedCode) {
            console.log(highlightedCode);
            element.html('');
            element.append('<code />');
            return element.find('code').append(highlightedCode);
          });
        }
      }
    };
  });

}).call(this);
