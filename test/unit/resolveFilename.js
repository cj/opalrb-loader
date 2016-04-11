'use strict'

const expect = require('chai').expect
const path = require('path')

const resolveFilename = require('../../lib/resolveFilename')
const bundlerCompilerTest = require('../support/bundlerCompilerTest')
const cleanBundledCompilers = require('../support/cleanBundledCompilers')

describe('resolveFilename', function(){
  this.timeout(10000)

  function bundlerResolve(done, filename, expectedAbsolute, expectedRelative, envOverrides) {
    const code = `const resolveFilename = require('lib/resolveFilename')\nconsole.log(JSON.stringify(resolveFilename('${filename}')))`
    bundlerCompilerTest.execute(code, function (err, result) {
      if (err) { return done(err) }
      try {
        const withoutMessage = /(Bundle derived.*Creating!\s)?(.*)/.exec(result)[2]
        const parsed = JSON.parse(withoutMessage)
        expect(parsed.absolute).to.match(expectedAbsolute)
        expect(parsed.relative).to.match(expectedRelative)
        return done()
      }
      catch (e) {
        return done(`Could not parse JSON ${result}`)
      }
    }, true, envOverrides)
  }

  beforeEach(cleanBundledCompilers)

  it('resolves a test fixture', function() {
    const result = resolveFilename('arity_1')

    expect(result.absolute).to.eq(path.resolve(__dirname, '../fixtures/arity_1.rb'))
    expect(result.relative).to.eq('../../arity_1.rb')
  })

  it('throws error if not found', function() {
    expect(function() { resolveFilename('not_found.rb')}).to.throw('Cannot find file - not_found.rb in load path ./test/fixtures,./test/fixtures/load_path')
  })

  it('uses Bundler load paths if Bundler is running', function(done) {
    bundlerResolve(done,
      'opal-factory_girl',
      /gems\/opal-factory_girl-.*\/opal\/opal-factory_girl\.rb/,
      /opal-factory_girl\.rb/)
  })

  it('uses Rails load paths if Rails is running', function(done) {
    bundlerResolve(done,
      'opal-browser',
      /gems\/opal-browser-.*\/opal\/opal-browser\.rb/,
      /opal-browser\.rb/,
      {RAILS_ENV: 'foobar'})
  })
})
