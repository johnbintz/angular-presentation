presentation = angular.module 'presentation', [ 'ui.keypress' ]

presentation.factory 'boundScopeHelper', ->
  (directive) ->
    originalCompile = directive.compile
    originalLink = directive.link

    directive.compile = (tE, tA, transclude) ->
      tA[key] = key for key, value of directive.scope

      if originalCompile?
        originalCompile(tE, tA, transclude)
      else if originalLink
        originalLink
      else
        (scope, element, attrs) ->

    delete directive.link

    directive

presentation.factory 'presentationOptions', ->
  class Options
    slides: []
    currentSlide: null

    addSlide: (id) ->
      @slides.push(id)
      @currentSlide ||= id

    currentSlideIndex: -> @slides.indexOf(@currentSlide)

    nextSlide: ->
      index = @currentSlideIndex() + 1
      if index < @slides.length
        @switchToSlide(index)

    previousSlide: ->
      index = @currentSlideIndex() - 1
      if index > -1
        @switchToSlide(index)

    switchToSlide: (index) ->
      @currentSlide = @slides[index]

    hasPrevious: ->
      @currentSlideIndex() > 0

    hasNext: ->
      @currentSlideIndex() < @slides.length - 1

    nextID: ->
      "slide-#{@slides.length}"

  new Options()

presentation.directive 'presentation',  ->
  restrict: 'E'
  transclude: true
  replace: true
  templateUrl: 'presentation.html'
  controller: ($scope, presentationOptions) ->
    $scope.options = presentationOptions

presentation.directive 'slide', (boundScopeHelper) ->
  boundScopeHelper(
    restrict: 'E'
    replace: true
    transclude: true
    templateUrl: 'slide.html'
    scope:
      'options': '='
    compile: (tE, tA, transclude) ->
      id = tA.id

      (scope, element, attrs) ->
        scope.id = id || scope.options.nextID()
        scope.options.addSlide(scope.id)

        scope.state ||= {}
        scope.codeBlocks ||= {}
  )

presentation.simpleDirective = (name, options = {}) ->
  @directive name, ($sce) ->
    restrict: 'E'
    replace: true
    transclude: true
    scope: true
    templateUrl: name + '.html'
    compile: (tE, tA, transclude) ->
      (scope, element, attrs) ->
        transclude scope, (clone, innerScope) ->
          clone = angular.element('<div />').append(clone)

          if options.postLink?
            options.postLink(scope, name, clone)
            scope[name] = $sce.trustAsHtml(scope[name])

presentation.simpleDirective 'title',
  postLink: (scope, name, clone) ->
    scope[name] = clone.text()

presentation.simpleDirective 'subtitle',
  postLink: (scope, name, clone) ->
    scope[name] = clone.html()

presentation.directive 'controls', ->
  restrict: 'E'
  replace: true
  templateUrl: 'controls.html'

codeGrabber = (scope, element, name) ->
  html = element.html()

  scope.codeBlocks ||= {}
  scope.codeBlocks[name] = html

presentation.directive 'script', ->
  restrict: 'E'
  link: (scope, element, attrs) ->
    if attrs.type == 'text/code-grabber'
      codeGrabber scope, element, attrs.for

presentation.directive 'codeGrabber', ->
  restrict: 'A'
  link: (scope, element, attrs) ->
    codeGrabber scope, element, attrs.codeGrabber

presentation.directive 'codeRunner', ($compile) ->
  restrict: 'E'
  replace: true
  link: (scope, element, attrs) ->
    element.after "<div class='code-runner' />"
    target = element.next()
    element.remove()

    scope.$watch(
      'codeBlocks',
      (codeBlocks) ->
        content = angular.element("<div />").append(codeBlocks[attrs.for])

        $compile(content)(scope)

        target.html('')
        target.append(content)
      , true
    )

processCodeBlock = (code, language, callback) ->
  prismLanguage = null

  beautifier = switch language
    when 'html'
      prismLanguage = 'markup'
      window.html_beautify
    when 'javascript', 'json'
      prismLanguage = 'javascript'
      window.js_beautify
    when 'css', 'scss', 'sass'
      prismLanguage = 'css'
      window.css_beautify
    else
      prismLanguage = language
      (code, options) -> code

  output = beautifier(code, { indent_size: 2 }).replace(/</g, "&lt;")

  lines = output.split("\n")
  length = lines[0].length - lines[0].replace(/^ */, '').length

  output = (line.substr(length) for line in lines).join("\n")

  callback(Prism.highlight(output, Prism.languages[prismLanguage]))

presentation.directive 'codeDisplayer', (boundScopeHelper) ->
  boundScopeHelper {
    restrict: 'E'
    replace: true
    scope: {
      codeBlocks: '='
      state: '='
    }
    templateUrl: 'code_displayer.html'
    link: (scope, element, attrs) ->
      scope.$watch(
        'codeBlocks', (codeBlocks) ->
          if codeBlocks && codeBlocks[attrs.for]
            processCodeBlock codeBlocks[attrs.for], attrs.language, (highlightedCode) ->
              element.find('code').append(highlightedCode)
        , true)
  }

presentation.directive 'pre', ->
  restrict: 'E'
  link: (scope, element, attrs) ->
    if attrs.language?
      processCodeBlock element.text(), attrs.language, (highlightedCode) ->
        console.log highlightedCode

        element.html('')
        element.append('<code />')
        element.find('code').append(highlightedCode)
