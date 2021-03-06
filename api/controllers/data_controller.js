'use strict';

//functions for handling all the data requests

var mongoose = require('mongoose'),
    uniqid = require('uniqid'),
    User = mongoose.model('User'),
    Code = mongoose.model('Code'),
    Store = mongoose.model('Store'),
    db_utilities = require('../../utility/db/db_utilities.js'),
    server = require('../../server.js');

const sha = require('simple-js-sha2-256');

//handlers for /stores

exports.get_all_stores = function(req, res){     //return all stores
    Store.find({}, async function(err, stores){
        if(err) res.send(err);
        const new_stores = stores.map(async(store)=>{       //one day maybe i'll understand promises
            let new_store = Object.assign({}, store.toObject());
            new_store.current_in_queue = await Code.count({store: new_store._id, status: "in_queue"}).exec();
            new_store.current_in_store = await Code.count({store: new_store._id, status: "in_store"}).exec();
            return new_store;
        });
        Promise.all(new_stores).then((lista)=>{
            res.json(lista);
        });
    });
}

exports.create_a_store = function (req, res){    //creates a new shop\
    var new_store = new Store({
        name: req.body.name,
        max_in_store: req.body.max_in_store,
        max_queue: req.body.max_queue
    });
    console.log(req.file);
    new_store.save(function(err, store){
        if(err) res.send(err);
        res.json(store);
    });
}

//handlers for /stores/:storeId

exports.get_a_store = function (req, res){      //return a store specified by parameter storeId
    db_utilities.find_store(req.params.storeId).
    then((store)=>{
        if(store){
            res.json(store);
        } else {
            res.status(404)
            .send('Store not found! Prova a controllare come hai scritto il nome del negozio');
        }
        
    });
}

exports.update_a_store = function (req, res){   //updates a store specified by parameter storeId
    Store.findByIdAndUpdate(req.params.storeId, req.body, {new: true}, function(err, store){
        if(err) res.status(500).send("Something went wrong: \n" + err);
        res.json(store);
    })
}

exports.delete_a_store = function (req, res){   //deletes a store specified by parameter storeID
    Store.remove({"_id": req.params.storeId}), function(err){
        if(err) res.status(500).send('Something went wrong: \n' + err);
        res.json({'name': req.params.storeId});
    }
}

//handlers for /stores/:storeId/logo

exports.get_a_store_logo = function (req, res){ //returns store logo of the store specified by parameter storeId
    db_utilities.find_store(req.params.storeId).
    then((store)=>{
        if(store){
            if(store.logo_path){
                res.sendFile(process.env.IMG_PATH + store.logo_path);
            } else {
                res.status(404)
                .send('Logo not found! Forse è ancora da aggiungere');
            }
        } else {
            res.status(404)
            .send('Store not found! Prova a controllare come hai scritto il nome del negozio');
        }
    });
}

//handlers for /stores/:storeId/codes

exports.get_store_codes = function (req, res){      //returns codes related to the store specified by parameter storeId
    Code.find({"store": req.params.storeId}, function(err, codes){
        if(err) res.status(500).send("Something went wrong: \n" + err);
        res.json(codes);
    })
}



//handlers for /stores/:storeId/codes/:code

exports.assign_code_to_store = async function(req,res){     //assigns a store (param. storeId) a to a code (param. code) and changes code status
    var storeId = req.params.storeId;
    console.log(req.params.code);
    var codeId = req.params.code;
    var store = await db_utilities.find_store(storeId);
    var code = await Code.findOne({'code': codeId});
    var event = '';
    switch(code.status[0]){
        case 'inactive':
            code.status = 'in_queue';
            code.store = store._id; 
            event = 'Code arrived in queue';
            break;
        case 'in_queue':
            code.status = 'in_store';
            event = 'Code entered the store';
            break;
        case 'in_store':
            code.status = 'inactive';
            code.store = null;
            event = 'Code exited the store';
            break;
    }
    code.updated_at = new Date();
    code.save();
    server.pusher.trigger('store-' + store._id, 'code-status-change', {    //canale per interfaccia web con id dello store come nome canale
        'message': event
    });
    server.pusher.trigger("codechange", 'code-status-change', { //canale per l'app android per sapere che c'è stato un cambiamento
        'message': event
    });
    res.send(code[0]);
}

exports.delete_store_code = function (req, res){
    var codeId = req.params.code;
    var code = Code.findOne({'code': codeId}, function(err, codeFound){
        if(err) res.status(500).send("Something went wrong while searching for the code: " + err);
        else {
            codeFound.store = null;
            codeFound.status = 'inactive';
            codeFound.save();
            console.log("Code " + codeFound.code + " deactivated");
            res.send(code.code);
        }
    });
}

//handlers for /users

exports.get_all_users = function (req, res){        //returns all the users
    User.find({}, function(err, users){
        if(err) res.status(500).send(err);
        res.json(users);
    })
}

exports.create_user = function (req, res){          //creates a new user
    var new_user = new User(req.body);
    new_user.password = sha(req.body.password + process.env.PSW_SECRET);
    new_user.save(function(err, user){
        if(err) res.send(err);
        res.json(user);
    });
}

//handlers for /users/:userId

exports.get_user = function (req, res){             //returns a user specified by parameter userId
    db_utilities.find_user(req.params.userId)
    .then((user)=>{
        if(user){
            res.json(user);
        } else {
            res.status(404).send('Utente non trovato! Prova a controllare di aver scritto nome o id giusti');
        }
    });
}

exports.update_user = function (req, res){          //updates a user specified by parameter userId
    User.findByIdAndUpdate(req.params.userId, req.body, {new: true}, function(err, user){
        if(err) res.status(404).send('Something went wrong: \n' + err);
        res.json(user);
    });
}

exports.delete_user = function (req, res){          //deletes a user specified by parameter userId
    User.deleteOne({'_id': req.params.userId}, function(err){
        if(err) res.status(404).sent("Something went wrong: \n"+err);
        res.json({'_id': req.params.userId});
    });
}

//handlers for /codes

exports.get_codes = function (req, res){            //returns all the codes
    Code.find({}, function(err,codes){
        if(err){
            res.status(404).send('Something went wrong: \n' + err);
        } else {
            res.json(codes);
        }
    });
}

exports.create_code = function(req, res){           //creates a new code
    var new_code = new Code(req.body);
    new_code.code = uniqid();
    new_code.save(function(err, code){
        if(err) res.send(err);
        res.json(code);
    });
}

//handlers for /codes/:codeId

exports.get_specific_code = function (req, res){    //returns a code object specified by  codeId
    Code.findById(req.params.codeId, function(err, code){
        if(err) res.status(404).send("Something went wrong: \n" + err);
        res.json(code);
    });
}