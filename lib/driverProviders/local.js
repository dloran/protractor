/*
 * This is an implementation of the Local Driver Provider.
 * It is responsible for setting up the account object, tearing
 * it down, and setting up the driver correctly.
 *
 * TODO - it would be nice to do this in the launcher phase,
 * so that we only start the local selenium once per entire launch.
 */
var util = require('util'),
    path = require('path'),
    remote = require('selenium-webdriver/remote'),
    fs = require('fs'),
    q = require('q'),
    DriverProvider = require('./driverProvider');

var LocalDriverProvider = function(config) {
  DriverProvider.call(this, config);
  this.server_ = null;
};
util.inherits(LocalDriverProvider, DriverProvider);


/**
 * Helper to locate the default jar path if none is provided by the user.
 * @private
 */
LocalDriverProvider.prototype.addDefaultBinaryLocs_ = function() {
  if (!this.config_.seleniumServerJar) {
    this.config_.seleniumServerJar = path.resolve(__dirname,
        '../../selenium/selenium-server-standalone-' +
        require('../../config.json').webdriverVersions.selenium + '.jar');
  }
  if (this.config_.capabilities.browserName === 'chrome') {
    this.config_.chromeDriver = this.config_.chromeDriver ||
        path.resolve(__dirname, '../../selenium/chromedriver');

    // Check if file exists, if not try .exe or fail accordingly
    if (!fs.existsSync(this.config_.chromeDriver)) {
      this.config_.chromeDriver += '.exe';
      // Throw error if the client specified conf chromedriver and its not found
      if (!fs.existsSync(this.config_.chromeDriver)) {
        throw new Error('Could not find chromedriver at ' +
          this.config_.chromeDriver);
      }
    }
  }
};

/**
 * Configure and launch (if applicable) the object's environment.
 * @public
 * @return {q.promise} A promise which will resolve when the environment is
 *     ready to test.
 */
LocalDriverProvider.prototype.setupEnv = function() {
  var deferred = q.defer(),
      self = this;

  this.addDefaultBinaryLocs_();
  if (!fs.existsSync(this.config_.seleniumServerJar)) {
    throw new Error('there\'s no selenium server jar at the specified ' +
      'location. Do you have the correct version?');
  }

  util.puts('Starting selenium standalone server...');

  // configure server
  if (this.config_.chromeDriver) {
    this.config_.seleniumArgs.push('-Dwebdriver.chrome.driver=' +
      this.config_.chromeDriver);
  }
  this.server_ = new remote.SeleniumServer(this.config_.seleniumServerJar, {
      args: this.config_.seleniumArgs,
      port: this.config_.seleniumPort
    });

  //start local server, grab hosted address, and resolve promise
  this.server_.start().then(function(url) {
    util.puts('Selenium standalone server started at ' + url);
    self.server_.address().then(function(address) {
      self.config_.seleniumAddress = address;
      deferred.resolve();
    });
  });

  return deferred.promise;
};

/**
 * Teardown and destroy the environment and do any associated cleanup.
 * Shuts down the drivers and server.
 *
 * @public
 * @override
 * @return {q.promise} A promise which will resolve when the environment
 *     is down.
 */
LocalDriverProvider.prototype.teardownEnv = function() {
  var self = this;
  var deferred = q.defer();
  DriverProvider.prototype.teardownEnv.call(this).then(function() {
    util.puts('Shutting down selenium standalone server.');
    self.server_.stop().then(function() {
      deferred.resolve();
    });
  });
  return deferred.promise;
};

// new instance w/ each include
module.exports = function(config) {
  return new LocalDriverProvider(config);
};
