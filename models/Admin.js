// /models/Admin.js
const {Schema, model} = require('mongoose');

const adminSchema = new Schema({
        telegramId: {type: Number, required: true, unique: true},
        username: {type: String, required: false}
    },
    {timestamps: true}
);

module.exports = model('Admin', adminSchema);
