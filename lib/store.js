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

// Attach driver method passthroughs.
['create','read','update','destroy','list','ready'].forEach(function(method){	
  Store.prototype[method] = function(){
    this.driver[method].apply(this.driver, arguments);
  };
});

module.exports = Store;