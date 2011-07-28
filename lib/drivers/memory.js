/**
 * Geck.store.memory - In-Memory storage driver for GECK.
 * 
 * Copyright (c) 2011 Stephen Belanger
 * Licensed under MIT License
 */
var _ = require('underscore');
var uuid = require('node-uuid');
var file = require('fs');

function Memory(config){
  this.store = {};
  this.config = config || {};

  // Load data from persistence file, if we are using one.
  if (config.file) {
    try {
      this.config.persist = true;
      var contents = file.readFileSync(config.file);
      this.store = JSON.parse(contents)[config.database];
    } catch (e) {}
  }
}

// Allow for basic persistence.
// WARNING: Don't use this for large datasets. It won't work.
Memory.prototype._persist = function(){
  if (this.config.persist) {
    var self = this;
    file.readFile(self.config.file, function(err, data){
      var json = JSON.parse(data);
      json[self.store];
      file.writeFile(self.config.file, json);
    });
  }
};

// Create
Memory.prototype.create = function(data, cb) {
  if (typeof data._id === 'undefined') {
    data._id = uuid();
  }
  this.store[data._id] = data;
  cb(null, this.store[data._id]);
};

// Read
Memory.prototype.read = function(id, cb) {
  cb(null, this.store[id]);
};

// Update
Memory.prototype.update = function(id, data, cb) {
  // Handle ID changing updates.
  if (typeof data._id !== 'undefined') {
    this.store[data._id] = data;
    delete this.store[id];
    id = data._id;
  
  // No ID change, handle normally.
  } else {
    this.store[id] = data;
    this.store[id]._id = id;
  }
  cb(null, this.store[id]);
};

// Destroy
Memory.prototype.destroy = function(id, cb) {
  delete this.store[id];
  cb();
};

// List
Memory.prototype.list = function(criteria, cb) {
  var vals = _.values(this.store);
  var matches = _.select(vals, function(row){
    var match = true;
    (criteria||{}).forEach(function(criteria_item){
      if (_.include(row, criteria_item)) {
        match = false;
      }
    })
    return match;
  });
  cb(null, matches);
};

module.exports = Memory;