var mongoose = require('mongoose'),
    User = mongoose.model('User'),
    Code = mongoose.model('Code'),
    Store = mongoose.model('Store');

//evaluates if string matches Id pattern, if so search object using id, 
//if not it searches the object by name
exports.find_store = async function(storeId){
    if (storeId.match(/^[0-9a-fA-F]{24}$/)) {
        return await Store.findById(storeId);
    } else {
        return await Store.findOne({'name': storeId});
    }
}

exports.find_user = async function(userId){
    if (userId.match(/^[0-9a-fA-F]{24}$/)) {
        return await User.findById(userId);
    } else {
        return await User.findOne({'name': userId});
    }
}

// exports.check_availability = async function(storeId){
//     var code_num = await Code.find({"sto"})
// }