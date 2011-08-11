/**
 * Geck.store.mongo - MongoDB storage driver for GECK.
 * 
 * Copyright (c) 2011 Stephen Belanger
 * Licensed under MIT License
 */
var mongo = require('mongodb');
var uuid = require('node-uuid');
var _ = require('underscore');
var chainer = require('chainer');

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
    //, { strict: true }
  );
  this.db = db;
  this.config = config;
  this.isready = false;

  var chain = new chainer();
  var next = function(){ chain.next.apply(chain, arguments); };
  chain.add(function(){
    self._openDB(db, next);
  });
  chain.add(function(db){
    self._auth(db, config, next);
  });
  chain.add(function(db){
    self._setCollection(db, config.collection, next);
  });
  chain.add(function(err, collection){
    if (err) throw new Error(err);
    self.collection = collection;
    self.isready = true;
    self.ready();
  });
  chain.run();
}

Mongo.prototype._openDB = function(db, cb) {
  var self = this;
  db.open(function(err, db) {
    if (err) throw new Error(err); else cb(db);
  });
}

Mongo.prototype._auth = function(db, c, cb) {
  if ( ! c.username || ! c.password) return cb(db);
  db.authenticate(c.username, c.password, function(err){
    if (err) throw new Error(err); else cb(db);
  });
};

Mongo.prototype._setCollection = function(db, collection, cb) {
  db.collection(collection, function(err, collection) {
    if (err) db.createCollection(collection, cb);
    else cb(null, collection);
  });
}

// Allows an access attempt to wait for readiness.
Mongo.prototype.ready = function(cb) {
  if (typeof cb === 'function') this.onready = cb;
  if (this.isready && typeof this.onready === 'function') {
    this.onready();
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
  this.collection.find(criteria).toArray(function(err, docs){
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