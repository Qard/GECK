/**
 * Geck.store - Driver-supported storage module for GECK. 
 * 
 * Copyright (c) 2011 Stephen Belanger
 * Licensed under MIT License
 */
var fs = require('fs');

// Load available database drivers in driver folder.
var drivers = {};
fs.readdirSync(__dirname+'/drivers').forEach(function(name){
  name = name.replace('.js','');
  drivers[name] = require('./drivers/'+name);
});

/**
 * Entry point for our data store abstraction object.
 * 
 * @param string
 *    Driver type.
 * 
 * @param object
 *    Configuration object to pass to the storage driver.
 */
function Store(type, config){
  if ( ! (this instanceof Store)) {
    return new Store(type, config);
  }
  this.type = type || 'memory';

  // Prepare the driver.
  this.driver = new drivers[this.type](config);
}

// Just set created_at/updated_at dates
// and pass execution on to storage driver.
Store.prototype.create = function(){
  arguments[0].created_at = new Date;
  arguments[0].updated_at = new Date;
  this.driver.create.apply(this.driver, arguments);
};

// Again, set updated_at date and
// pass execution on to storage driver.
Store.prototype.update = function(){
  arguments[1].updated_at = new Date;
  this.driver.update.apply(this.driver, arguments);
};

// Make criteria optional.
Store.prototype.list = function(){
  var args = Array.prototype.slice.call(arguments);
  if (typeof args[0] === 'function') {
    args[1] = args[0];
    args[0] = {};
  }
  this.driver.list.apply(this.driver, args);
};

// Attach driver method passthroughs.
['read','destroy','ready'].forEach(function(method){	
  Store.prototype[method] = function(){
    this.driver[method].apply(this.driver, arguments);
  };
});

module.exports = Store;