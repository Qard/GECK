var a = require('assert');
var Chainer = require('chainer');
var Store = require('../lib/store');
var fs = require('fs');

// Get list of available drivers.
var drivers = [];
fs.readdirSync('../drivers').forEach(function(name){
  drivers.push(name.replace('.js',''));
});

// Run test list for every driver.
drivers.forEach(function(driver){
  var chain = Chainer();
  var db = Store(driver, {
    database:'users'
  });

  a.ok(db instanceof Store, 'instance created');

  // Test create.
  chain.add(function(){
    db.create({ test: 'blah' }, function(err, doc) {
      a.ok( ! err && doc, 'document created');
      chain.next(doc);
    });
  });

  // Test read.
  chain.add(function(doc){
    db.read(doc._id, function(err, doc) {
      a.ok( ! err && doc, 'document read');
      chain.next(doc);
    });
  });

  // Test update.
  chain.add(function(doc){
    db.update(doc._id, { test: 'blargh' }, function(err, doc) {
      a.ok( ! err && doc, 'document updated');
      chain.next(doc);
    });
  });

  // Test list.
  chain.add(function(doca){
    db.list(function(err, doc) {
      a.ok( ! err && doc, 'documents listed');
      chain.next(doca);
    });
  });

  // Test id-changing update.
  chain.add(function(doc){
    db.update(doc._id, { _id:'test', test: 'blargh' }, function(err, doc) {
      a.ok( ! err && doc, 'document updated with id');
      chain.next(doc);
    });
  });

  // Test destroy.
  chain.add(function(doc){
    db.destroy(doc._id, function(err) {
      a.ok( ! err, 'document destroyed');
      console.log('all tests passed for '+driver+' driver');
    });
  });

  chain.run();
});