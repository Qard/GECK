/**
 * Geck.store.memory - In-Memory storage driver for GECK.
 * 
 * Copyright (c) 2011 Stephen Belanger
 * Licensed under MIT License
 */
var mongo = require("mongodb");
var uuid = require('node-uuid');
var _ = require('underscore');

/**
 * Mongo driver entry point. This gets applied onto the Storage module.
 * 
 * @param object
 *    This is generic object to pass to the actual database module.
 */
function Mongo(config){
  var self = this;
  var db = new mongo.Db(
    config.database || 'geck'
    , new mongo.Server(
      config.host || "127.0.0.1"
      , config.port || 27017
      , config.options || {}
    )
    , { strict: true }
  );
  this.db = db;

  // Open the connection.
  db.open(function(err, db) {
    db.collection(config.collection, function(err, collection) {
      if (err) {
        db.createCollection(config.collection, function(err, collection) {
          self.collection = collection;
        });
      } else {
        self.collection = collection;
        if (typeof self.onready === 'function') {
          self.ready(self.onready);
        }
      }
    });
  });
}

// Allows an access attempt to wait for readiness.
Mongo.prototype.ready = function(cb) {
  if (typeof this.collection !== 'undefined') {
    cb();
  } else {
    this.onready = cb;
  }
};

// Create
Mongo.prototype.create = function(data, cb) {
  ensureId(null, data);
  this.collection.insert(data, function(err, doc){
    cb(err, hidePriv(doc[0]));
  });
};

// Read
Mongo.prototype.read = function(id, cb) {
  var criteria = typeof id === 'object' ? criteria : { id: id };
  this.collection.find(criteria, { limit:1 }).toArray(function(err, docs){
    cb(err, hidePriv(err ? undefined : docs[0]));
  });
};

// Update
Mongo.prototype.update = function(id, data, cb) {
  ensureId(id, data);
  this.collection.update({id: id}, data, function(err, doc){
    cb(err, hidePriv(doc));
  });
};

// Destroy
Mongo.prototype.destroy = function(id, cb) {
  this.collection.remove({id: id}, cb);
};

// List
Mongo.prototype.list = function(criteria, cb) {
  if (typeof criteria === 'function') {
    cb = criteria;
    criteria = null;
  }
  this.collection.find(criteria||{}).toArray(function(err, docs){
    if ( ! err) { docs.forEach(function(doc){ doc = hidePriv(doc); }); }
    cb(err, docs);
  });
};

module.exports = Mongo;

// Swap out the private id for the public id.
// We need this to allow the id to be editable,
// since Mongo doesn't support that by default.
function hidePriv(data){
  if (typeof data !== 'undefined') {
    data._id = data.id;
    delete data.id;
  }
  return data;
}

// Make sure our data object has an id attached.
function ensureId(id, data){
  if (typeof data.id === 'undefined') {
    data.id = id || uuid();
  }
  return data;
}