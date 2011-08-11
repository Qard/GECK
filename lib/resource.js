/**
 * Geck.resource - Resource builder for GECK. 
 * 
 * Copyright (c) 2011 Stephen Belanger
 * Licensed under MIT License
 */
var Store = require('./store');
var _ = require('underscore');
var Inflect = require('inflectjs');

/**
 * Resource Constructor.
 * 
 * Prepare a named resource to be built.
 */
function Resource(name, def, ctx){
  if ( ! (this instanceof Resource)) {
    return new Resource(name, def);
  }

  // Merge collection and database names into def.db
  def.db = _.defaults({
    database: def.db.database || def.db.name,
    collection: name
  }, def.db);

  // Make sure name is singular.
  this.name = name;
  this.def = def;
  this.ctx = ctx;

  // Make sure the database is ready and associate with this resource.
  this.db = new Store(this.def.db.type, this.def.db);
}

// DRY up the geck emitter stuff a bit.
Resource.prototype.emitter = function(req, cb) {
  return function(err, doc) {
    if (typeof cb === 'function') cb(doc);
    req.geck.emit(err ? 'error' : 'success', err ? err : doc);
  };
}

/**
 * Builds the resource routes.
 * 
 * This needs some serious refactoring to DRY up the relational routes.
 */
Resource.prototype.build = function() {
  var self = this;
  var ctx = this.ctx;

  /*********
   * Create
   *********/
  ctx.route('post', '/'+self.name+'/:id?', function(req, res) {
    // Ensure request body exists.
    if ( ! req.body) { req.body = {}; }
    self.def.create(req, res);

    // Store the creation process for later.
    var create = function() {
      // Run Validations.
      if ( ! self.def.validate(req.body)) {
        req.geck.emit('error', 'Validation failure.');
      
      // Validation succeeded. Attempt the creation.
      } else {
        // Prepend id, if available.
        if (self.def.allow_forced_ids && req.params.id) {
          req.body.id = req.params.id;
        
        // Remove the ID, if allow_forced_ids is
        // disabled and an id is present.
        } else if ( ! self.def.allow_forced_ids && typeof req.body !== 'undefined' && req.body.id) {
          delete req.body.id;
        }

        // Make our dynamically structured database call.
        self.db.create(req.body||{}, self.emitter(req, self.def.after_create));
      }
    };

    // Check non-existence, if id supplied.
    if (self.def.allow_forced_ids && req.params.id) {
      self.db.read(req.params.id, function(err, doc) {
        if (err) {
          req.geck.emit('error', 'That id is in use.');
        } else {
          create();
        }
      });
    
    // Otherwise, just jump into our creator.
    } else {
      create();
    }
  });

  /*********
   * Read
   *********/
  ctx.route('get', '/'+self.name+'/:id', function(req, res) {
    self.def.read(req, res);
    self.db.read(req.params.id, self.emitter(req));
  });

  /*********
   * Update
   *********/
  ctx.route('put', '/'+self.name+'/:id', function(req, res) {
    self.def.update(req, res);

    // Remove _id, if allow_forced_ids is not enabled.
    if ( ! self.def.allow_forced_ids) { delete req.body._id; }

    // Run validations.
    if ( ! self.def.validate(req.body)) {
      req.geck.emit('error', 'Validation failure.');

    // Validation succeeded. Attempt the update.
    } else {
      self.db.update(req.params.id, req.body, self.emitter(req, self.def.after_update));
    }
  });

  /*********
   * Destroy
   *********/
  ctx.route('del', '/'+self.name+'/:id', function(req, res) {
    self.def.destroy(req, res);
    self.db.destroy(req.params.id, self.emitter(req));
  });

  /*********
   * List
   *********/
  ctx.route('get', '/'+Inflect.plural(self.name), function(req, res) {
    self.def.list(req, res);
    self.db.list(self.emitter(req));
  });


  /****************************************
   * 
   * Define one-to-many relational routes.
   * 
   ****************************************/
  _.each(self.def.many, function(r){
    // Ensure singularization.
    r = Inflect.singular(r);

    // We need a different db connection for the relations.
    var r_db = new Store(self.def.db.type, _.defaults({ collection: r }, self.def.db));

    /*********
     * Create
     *********/
    ctx.route('post', '/'+self.name+'/:id/'+r, function(req, res) {
      self.def.create(req, res);
      var data = req.body || {};
      data[self.name+'_id'] = req.params.id;
      r_db.create(data, self.emitter(req));
    });

    /*********
     * Update
     *********/
    ctx.route('put', '/'+self.name+'/:id/'+r+'/:r_id', function(req, res) {
      self.def.update(req, res);
      var data = req.body || {};
      data[self.name+'_id'] = req.params.id;
      r_db.update(req.params.r_id, data, self.emitter(req));
    });

    /*********
     * Read
     *********/
    ctx.route('get', '/'+self.name+'/:id/'+r+'/:r_id', function(req, res) {
      self.def.read(req, res);
      r_db.read(req.params.r_id, self.emitter(req));
    });

    /*********
     * Destroy
     *********/
    ctx.route('del', '/'+self.name+'/:id/'+r+'/:r_id', function(req, res) {
      self.def.destroy(req, res);
      r_db.destroy(req.params.r_id, self.emitter(req));
    });

    /*********
     * List
     *********/
    ctx.route('get', '/'+self.name+'/:id/'+Inflect.plural(r), function(req, res) {
      self.def.read(req, res);
      criteria = req.query || {};
      criteria[self.name+'_id'] = req.params.id;
      r_db.list(criteria, self.emitter(req));
    });
  });


  /****************************************
   * 
   * Define one-to-one relational routes.
   * 
   ****************************************/
  _.each(self.def.one, function(r){
    // Ensure singularization.
    r = Inflect.singular(r);

    // We need a different db connection for the relations.
    var r_db = new Store(self.def.db.type, _.defaults({
      collection: r
    }, self.def.db));

    /*********
     * Read
     *********/
    ctx.route('get', '/'+self.name+'/:id/'+r, function(req, res) {
      self.def.read(req, res);
      self.db.read(req.params.id, function(err, doc) {
        r_db.read(doc[r+'_id'], self.emitter(req));
      });
    });
  });
  

  /****************************************
   * 
   * Define many-to-many relational routes.
   * 
   ****************************************/
  _.each(self.def.many_to_many, function(p, r){
    // Ensure singularization.
    r = Inflect.singular(r);
    p = Inflect.singular(p);

    // We need a different db connection for the relations and pivot table.
    var r_db = new Store(self.def.db.type, _.defaults({ collection: r }, self.def.db));
    var p_db = new Store(self.def.db.type, _.defaults({ collection: p }, self.def.db));

    /************
     * Associate
     ************/
    ctx.route('post', '/'+self.name+'/:id/'+r+'/:r_id?', function(req, res) {
      self.def.read(req, res);

      // Set search criteria.
      var criteria = req.body || {};
      criteria[self.name+'_id'] = req.params.id;
      if (typeof req.params.relation_id !== 'undefined') {
        criteria[r+'_id'] = req.params.r_id;
      }
      
      // Make sure the relation doesn't exist yet.
      p_db.read(criteria, function(err, doc){
        if ( ! err) req.geck.emit('error', p+' already exists.');
        else {
          p_db.create(criteria, self.emitter(req));
        }
      });
    });

    /********
     * List
     ********/
    ctx.route('get', '/'+self.name+'/:id/'+Inflect.plural(r), function(req, res){
      self.def.list(req, res);
      var criteria = {};
      criteria[self.name+'_id'] = req.params.id;
      p_db.list(criteria, function(err, docs){
        if (err) req.geck.emit('error', err);
        else {
          var ids = _.map(docs, function(val, key){ return val[r+'_id']; });
          r_db.list({ id: { '$in': ids } }, self.emitter(req));
        }
      });
    });
  });
};

module.exports = Resource;