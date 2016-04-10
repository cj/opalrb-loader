'use strict'

const expect = require('chai').expect
const execSync = require('child_process').execSync

const transpile = require('../../lib/transpile')
const alternateCompilerTest = require('../support/alternateCompilerTest')
const opalCompilerFilename = require('../../lib/getOpalCompilerFilename')
const bundlerCompilerTest = require('../support/bundlerCompilerTest')

describe('transpile', function(){
  const wpContext = {
    path: 'the_loader_path'
  }

  afterEach(function() {
    // was causing some state issues between tests
    delete process.env.OPAL_USE_BUNDLER
  })

  function doTranspile(code, options, filename, relativeFileName) {
    const targetOptions = {
      sourceRoot: process.cwd(),
      filename: filename || 'foo.rb',
      relativeFileName: relativeFileName || 'foo.rb'
    }
    Object.assign(targetOptions, options)
    return transpile(code, targetOptions, wpContext).code
  }

  it('compiles an endpoint', function() {
    var result = doTranspile('HELLO=123')

    expect(result).to.include('Opal.cdecl($scope, \'HELLO\', 123)')
    expect(result).to.not.include('Opal.modules')
  })

  it('passes bundled opal through', function() {
    var result = doTranspile('the code',
                             {},
                             opalCompilerFilename,
                             'opal-compiler.js')
    expect(result).to.eq('process = undefined;\nthe code')
  })

  // simple stub "template"
  it('allows stubbing opal requires so they can be provided outside webpack', function() {
    const options = {
      externalOpal: true
    }

    var result = doTranspile('require "opal"; HELLO=123', options)

    expect(result).to.include('Opal.cdecl($scope, \'HELLO\', 123)')
    expect(result).to.not.include("require('!!the_loader_path?file=opal")
    expect(result).to.not.include('Opal.modules["opal"]')
  })

  it('loads an Opal compiler from a configurable file', function(done) {
    const code = `var transpile = require('lib/transpile');\n`+
    "console.log(transpile('HELLO=123', {filename: '/foo.rb', relativeFileName: 'foo.rb'}, {path: 'the_loader_path'}).code);"

    alternateCompilerTest.execute(code, function(err, result) {
      if (err) { return done(err) }
      expect(result).to.include('Generated by Opal 0.10.0.beta2.webpacktest')
      return done()
    })
  })

  it('passes custom configured Opal through', function(done) {
    const code = `var transpile = require('lib/transpile');\n`+
    `const code = transpile('the code', {filename: '${alternateCompilerTest.absolutePath}', relativeFilename: '${alternateCompilerTest.relativePath}'}, {path: 'the_loader_path'}).code\n` + 'console.log(code)'

    alternateCompilerTest.execute(code, function(err, result) {
      if (err) { return done(err) }
      expect(result).to.eq('process = undefined;\nthe code')
      return done()
    })
  })

  it('can use a Bundler provided version of Opal', function (done) {
    this.timeout(6000)

    const code = `var transpile = require('lib/transpile');\n`+
    "console.log(transpile('HELLO=123', {filename: '/foo.rb', relativeFileName: 'foo.rb'}, {path: 'the_loader_path'}).code);"

    bundlerCompilerTest.execute(code, function(err, result) {
      if (err) { return done(err) }

      // travis config runs these 2 right now
      if (execSync('opal -v').toString().trim().indexOf('0.9') != -1) {
        expect(result).to.include('Generated by Opal 0.9.2')
      }
      else{
        expect(result).to.include('Generated by Opal 0.10.0.beta2')
      }

      return done()
    })
  })

  describe('webpack requires', function() {
    it('standard', function() {
      var result = doTranspile('require "another_dependency"')

      expect(result).to.match(/require\('!!the_loader_path\?file=another_dependency&requirable=true!.*\/test\/fixtures\/another_dependency\.rb'\);/)
    })

    context('for compiler js file', function () {
      context('using bundled redirects requires for', function() {
        it('opal', function() {
          var result = doTranspile('require "opal"')

          expect(result).to.match(/require\('!!the_loader_path\?file=opal&requirable=false!.*\/vendor\/opal-compiler.js'\);/)
        })
        it('opal/full', function() {
          var result = doTranspile('require "opal/full"')

          expect(result).to.match(/require\('!!the_loader_path\?file=opal%2Ffull&requirable=false!.*\/vendor\/opal-compiler.js'\);/)
        })
        it('opal/mini', function() {
          var result = doTranspile('require "opal/mini"')

          expect(result).to.match(/require\('!!the_loader_path\?file=opal%2Fmini&requirable=false!.*\/vendor\/opal-compiler.js'\);/)
        })
      })

      function runOpalRequireTest(ruby, expectedMatch, done) {
        const code = `var transpile = require('lib/transpile');\n`+
            `console.log(transpile('${ruby}', {filename: '/foo.rb', relativeFileName: 'foo.rb'}, {path: 'the_loader_path'}).code);`

        alternateCompilerTest.execute(code, function(err, result) {
          if (err) { return done(err) }
          expect(result).to.match(expectedMatch)
          return done()
        })
      }

      context('using custom file redirects requires for', function() {
        it('opal', function(done) {
          runOpalRequireTest('require "opal"',
            /require\('!!the_loader_path\?file=opal&requirable=false!.*tweakedOpalCompiler.js'\);/,
            done)
        })
        it('opal/full', function(done) {
          runOpalRequireTest('require "opal/full"',
            /require\('!!the_loader_path\?file=opal%2Ffull&requirable=false!.*tweakedOpalCompiler.js'\);/,
            done)
        })
        it('opal/mini', function(done) {
          runOpalRequireTest('require "opal/mini"',
            /require\('!!the_loader_path\?file=opal%2Fmini&requirable=false!.*tweakedOpalCompiler.js'\);/,
            done)
        })
      })
    })

    context('for bundler provided opal', function() {
      describe('does not redirect', function() {
        it('opal')
        it('opal/full')
        it('opal/mini')
      })
    })

    it('node convention', function() {
      var result = doTranspile('require "./another_dependency"')

      expect(result).to.match(/require\('!!the_loader_path\?file=\.%2Fanother_dependency&requirable=true!.*\/test\/fixtures\/another_dependency\.rb'\);/)
    })

    it('JS require', function() {
      var result = doTranspile('require "pure_js"')

      expect(result).to.match(/require\('imports!.*test\/fixtures\/pure_js.js'\);/)
    })
  })

  describe('stubbed module declarations', function() {
    it('via require', function() {
      const options = {
        stubs: ['stubbed']
      }
      var result = doTranspile('require "stubbed"; HELLO=123', options)

      expect(result).to.include('Opal.cdecl($scope, \'HELLO\', 123)')
      expect(result).to.include('Opal.modules["stubbed"]')
    })

    it('via require_relative', function() {
      const options = {
        stubs: ['stubbed']
      }
      var result = doTranspile('require_relative "stubbed"; HELLO=123', options)

      expect(result).to.include('Opal.cdecl($scope, \'HELLO\', 123)')
      expect(result).to.include('Opal.modules["stubbed"]')
    })

    it('via node conventions', function() {
      const options = {
        stubs: ['stubbed']
      }

      var result = doTranspile('require "./stubbed"; HELLO=123', options)

      expect(result).to.include('Opal.cdecl($scope, \'HELLO\', 123)')
      expect(result).to.include('Opal.modules["stubbed"]')
    })
  })

  it('Opal require statements', function() {
    var result = doTranspile('require "another_dependency"')

    expect(result).to.include('self.$require("another_dependency")')
  })

  it('passes on requirable', function() {
    var result = doTranspile('HELLO=123', {requirable: true}, '/stuff/foo.rb', 'foo.rb')

    expect(result).to.include('Opal.cdecl($scope, \'HELLO\', 123)')
    expect(result).to.include('Opal.modules["foo"]')
  })

  it('passes on compile options', function() {
    var result = doTranspile('def abc(hi); end;', {arity_check: true})

    expect(result).to.include('Opal.ac')
  })
})
