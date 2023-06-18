const express = require('express');
const router = express.Router();
// const cookieParser = require('cookie-parser');
// router.use(cookieParser());

const multer = require('multer');
const path = require('path');
const fs = require('fs')

const shippingFees = require('../middleware/ship')

const Storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads');
    },
    filename: (req, file, cb) => {
        // console.log(file)
        cb(null, Date.now() + path.extname(file.originalname))
    },
});

const upload = multer({
    storage: Storage,
});

require('../middleware/passport')

const { userAuth, checkUser } = require('../middleware/auth');
const Account = require('../models/Account');
const Order = require('../models/Order');

// models / database
const Product = require('../models/Product')
const ShoppingCart = require('../models/Shopping_Cart');
const Pre_Order = require('../models/Pre_Order');
const Category = require('../models/Category')

const session = require('express-session');
router.use(session({
    secret: 'mysecretkey',
    resave: false,
    saveUninitialized: true,
}));

const flash = require('express-flash');
router.use(flash());

router.get('/*', userAuth, checkUser)
router.post('/*', userAuth, checkUser)

router.route('/home')
.get((req, res) => {
    res.render('user/home')
})

router.route('/product')
.get(async(req, res) => {
    const cat = req.query.category
    let renderProduct
    if(!cat){
        renderProduct = await Product.find({isArchive: false, product_stock: {$gt: 0}})
    }else{
        renderProduct = await Product.find({product_category: cat, isArchive: false, product_stock: {$gt: 0}})
    }
    const category = await Category.find()
    res.render('user/product', {renderProduct, category})
})

router.route('/product/:id/add-to-cart')
.post(async(req, res) => {
    const product_id = req.params.id
    const user_id = res.locals.user.id

    const product = await Product.findById(product_id)

    const cart = await ShoppingCart.findOne({user_id: user_id})
    // check if user already have a cart
    if(cart){
        let itemIndex = cart.items.findIndex(p => p.product_id == product_id);
        // check if user already have the same item in the cart else push the new item
        if(itemIndex > -1){
            let prodItem = cart.items[itemIndex]
            if(product.product_stock > prodItem.product_quantity){
                prodItem.product_quantity = prodItem.product_quantity + 1
            }
            prodItem.product_price = product.product_price * prodItem.product_quantity
            // console.log(prodItem.product_quantity)
        }else{
            if(product.product_stock > 0){
                cart.items.push({
                    product_id: product_id,
                    product_name: product.product_name,
                    product_quantity: 1,
                    product_price: product.product_price,
                    product_image: product.img_name,
                })
            }
        }
        cart.save()
        
    }else{
        // console.log('empty')
        const addCart = await ShoppingCart({
            user_id: user_id,
            items: [{
                product_id: product_id,
                product_name: product.product_name,
                product_quantity: 1,
                product_price: product.product_price,
                product_image: product.img_name,
            }]
        })
        addCart.save()
    }
    res.redirect('/user/product')
})

router.route('/cart')
.get(async(req, res) => {
    try{
        const id = res.locals.user.id;
        const product = await Product.find()
        const cart = await ShoppingCart.findOne({user_id: id})
        let shipping_fee = 0;
        let city = shippingFees.find(p => p.city == res.locals.user.city)
        // console.log(city)
        if(city){
            let barangay = city.barangays.find(p => p.name == res.locals.user.barangay)
            if(barangay){
                shipping_fee = barangay.fee
            }
        }
        // console.log(product)
        let newcart = [];
        if(cart != null){
            cart.items.forEach((item) => {
                let stats = ''
                let findItem = product.find(p => p.id == item.product_id)
                if(findItem){
                    if(findItem.product_stock <= 0){
                        stats = 'out of stock'
                    }else if(findItem.product_stock < item.product_quantity){
                        stats = 'not enough stock'
                    }
                }
                newcart.push({
                    product_id: item.product_id,
                    product_name: item.product_name,
                    product_quantity: item.product_quantity,
                    product_price: item.product_price,
                    product_image: item.product_image,
                    product_stats: stats
                })
            })
        }
        res.render('user/cart', {newcart, shipping_fee})
    }
    catch(err){
        console.log(err.message)
    }
})

router.route('/cart/:id/add')
.post(async(req, res) => {
    const product_id = req.params.id
    const user_id = res.locals.user.id

    const product = await Product.findById(product_id)
    const cart = await ShoppingCart.findOne({user_id: user_id})

    let itemIndex = cart.items.findIndex(p => p.product_id == product_id);
    if(itemIndex > -1){
        let prodItem = cart.items[itemIndex]
        if(product.product_stock > prodItem.product_quantity){
            prodItem.product_quantity = prodItem.product_quantity + 1
        }else{
            console.log('not enough stock')
        }
        prodItem.product_price = product.product_price * prodItem.product_quantity
        // console.log(prodItem.product_quantity)
    }
    cart.save()

    res.redirect('/user/cart')
})

router.route('/cart/:id/deduc')
.post(async(req, res) => {
    const product_id = req.params.id
    const user_id = res.locals.user.id

    const product = await Product.findById(product_id)
    const cart = await ShoppingCart.findOne({user_id: user_id})

    let itemIndex = cart.items.findIndex(p => p.product_id == product_id);
    if(itemIndex > -1){
        let prodItem = cart.items[itemIndex]
        prodItem.product_quantity = prodItem.product_quantity - 1
        prodItem.product_price = product.product_price * prodItem.product_quantity
        if(prodItem.product_quantity <= 0){
            cart.items.splice(itemIndex, 1)
        }
    }
    cart.save()

    res.redirect('/user/cart')
})

router.route('/cart/:id/remove')
.get(async(req, res) => {
    const product_id = req.params.id
    const user_id = res.locals.user.id

    const product = await Product.findById(product_id)
    const cart = await ShoppingCart.findOne({user_id: user_id})

    let itemIndex = cart.items.findIndex(p => p.product_id == product_id);
    if(itemIndex > -1){
        cart.items.splice(itemIndex, 1)
    }
    cart.save()
    res.redirect('/user/cart')
})

router.route('/cart/place-order')
.post(upload.single('image'), async(req, res) => {
    const id = res.locals.user.id;
    const payment_method = req.body.payment_method;
    const cart = await ShoppingCart.findOneAndDelete({user_id: id}).populate('items')
    console.log(cart.items, 1)
    let sub_total = 0
    let shipping_fee = 0;
    let city = shippingFees.find(p => p.city == res.locals.user.city)
    if(city){
        let barangay = city.barangays.find(p => p.name == res.locals.user.barangay)
        if(barangay){
            console.log(barangay.fee)
            shipping_fee = barangay.fee
        }
    }
    cart.items.forEach(data => {
        sub_total = sub_total + data.product_price
    })
    // console.log(total)
    const product = cart.items.map(item => ({
        product_id: item.product_id,
        name: item.product_name,
        price: item.product_price,
        quantity: item.product_quantity,
    }))
    // console.log(product)
    if(payment_method == 'COD'){
        const order = await Order({
            order_type: 'USER',
            fullname: `${res.locals.user.firstname} ${res.locals.user.middlename} ${res.locals.user.lastname}`,
            user_id: id,
            items: product,
            sub_total: sub_total,
            total_amount: sub_total + shipping_fee,
            zip_code: res.locals.user.zip_code,
            house_no: res.locals.user.house_no,
            barangay: res.locals.user.barangay,
            city: res.locals.user.city,
            province: res.locals.user.province,
            contact_number: res.locals.user.contact_number,
            payment_method: payment_method,
        })
        order.save()
        .then(() => console.log(order))
        .catch(err => console.log(err.message))
    }else{
        const order = await Order({
            order_type: 'USER',
            fullname: `${res.locals.user.firstname} ${res.locals.user.middlename} ${res.locals.user.lastname}`,
            user_id: id,
            items: product,
            sub_total: sub_total,
            total_amount: sub_total + shipping_fee,
            zip_code: res.locals.user.zip_code,
            house_no: res.locals.user.house_no,
            barangay: res.locals.user.barangay,
            city: res.locals.user.city,
            province: res.locals.user.province,
            contact_number: res.locals.user.contact_number,
            payment_method: payment_method,
            img_name: req.file.filename,
            image: {
                data: fs.readFileSync('uploads/' + req.file.filename),
                contentType: 'image/png'
            }
        })
        order.save()
        .then(() => console.log(order))
        .catch(err => console.log(err.message))
    }
    
    res.redirect('/user/cart')
})


router.route('/update-address')
.get((req, res) => {
    res.render('user/update_address')
})
.post(async(req, res) => {
    // const {complete_address} = req.body;
    const {province, city, barangay, house_no, zip_code} = req.body
    const update = await Account.findByIdAndUpdate(res.locals.user.id, {
        zip_code,
        house_no,
        barangay,
        city,
        province,
    }, {new: true})
    res.redirect('/user/cart')
})

router.route('/update-number')
.get((req, res) => {
    res.render('user/update_number')
})
.post(async(req, res) => {
    const {contact_number} = req.body;
    const update = await Account.findByIdAndUpdate(res.locals.user.id, {contact_number: contact_number}, {new: true})
    console.log(update)
    res.redirect('/user/cart')
})

router.route('/account')
.get((req, res) => {
    res.render('user/account', {messages: req.flash('message')})
    
})

router.route('/update-info')
.get((req, res) => {
    res.render('user/update_info')
})
.post(async(req, res) => {
    const id = res.locals.user.id
    const {firstname, middlename, lastname, contact_number, email, house_no, zip_code, barangay, city, province} = req.body
    const user = await Account.findByIdAndUpdate(id, {
        firstname,
        middlename,
        lastname,
        contact_number,
        email,
        house_no,
        zip_code,
        barangay,
        city,
        province,
    }, {new: true})
    res.redirect('/user/account')
})

router.route('/update-password')
.post(async(req, res) => {
    const id = res.locals.user.id
    const {current_password, new_password} = req.body
    const user = await Account.findById(id)
    if(user){
        if(user.password == current_password){
            const user = await Account.findByIdAndUpdate(id, {
                password: new_password
            }, {new: true})
            req.flash('message', 'Change Password Successfully ')
            console.log('successfully update')
        }else{
            req.flash('message', 'Password do not Match')
            console.log('doesnt match')
        }
    }
    res.redirect('/user/account')
})

router.route('/order')
.get(async(req, res) => {
    const order = await Order.find({user_id: res.locals.user.id, status: {$nin : ['cancelled','delivered']}})
    res.render('user/order', {order})
})

router.route('/order/:id')
.post(async(req, res) => {
    const id = req.params.id
    await Order.findByIdAndUpdate(id, {status: 'cancelled'}, {new: true})
    res.redirect('/user/order')
})

router.route('/history')
.get(async(req, res) => {
    const order = await Order.find({user_id: res.locals.user.id, status: {$in: ['delivered', 'cancelled'] }})
    res.render('user/history', {order})
})

router.route('/order-summary/:id')
.get(async(req, res) => {
    const id = req.params.id;
    const item = await Product.findById(id)
    const product = await Product.findById(id)
    let shipping_fee = 0;
    let city = shippingFees.find(p => p.city == res.locals.user.city)
    if(city){
        let barangay = city.barangays.find(p => p.name == res.locals.user.barangay)
        if(barangay){
            console.log(barangay.fee)
            shipping_fee = barangay.fee
        }
    }
    res.render('user/order_summary', {item, shipping_fee})
})
.post(upload.single('image'), async(req, res) => {
    const id = req.params.id;
    const user_id = res.locals.user.id
    const product = await Product.findById(id)
    let shipping_fee = 0;
    let city = shippingFees.find(p => p.city == res.locals.user.city)
    if(city){
        let barangay = city.barangays.find(p => p.name == res.locals.user.barangay)
        if(barangay){
            console.log(barangay.fee)
            shipping_fee = barangay.fee
        }
    }
    console.log(req.body.payment_method)
    if(req.body.payment_method == 'COD'){
        let sub_total = product.product_price * req.body.quantity
        let total_amount = sub_total + shipping_fee
        const order = await Order({
            order_type: 'USER',
            fullname: `${res.locals.user.firstname} ${res.locals.user.middlename} ${res.locals.user.lastname}`,
            user_id: user_id,
            items: [{
                product_id: id,
                name: product.product_name,
                price: product.product_price,
                quantity: req.body.quantity
            }],
            sub_total: sub_total,
            total_amount: total_amount,
            zip_code: res.locals.user.zip_code,
            house_no: res.locals.user.house_no,
            barangay: res.locals.user.barangay,
            city: res.locals.user.city,
            province: res.locals.user.province,
            contact_number: res.locals.user.contact_number,
            payment_method: req.body.payment_method
        })
        order.save()
        .then(() => console.log(order))
    }else{
        let sub_total = product.product_price * req.body.quantity
        let total_amount = sub_total + shipping_fee
        const order = await Order({
            order_type: 'USER',
            fullname: `${res.locals.user.firstname} ${res.locals.user.middlename} ${res.locals.user.lastname}`,
            user_id: user_id,
            items: [{
                product_id: id,
                name: product.product_name,
                price: product.product_price,
                quantity: req.body.quantity
            }],
            sub_total: sub_total,
            total_amount: total_amount,
            zip_code: res.locals.user.zip_code,
            house_no: res.locals.user.house_no,
            barangay: res.locals.user.barangay,
            city: res.locals.user.city,
            province: res.locals.user.province,
            contact_number: res.locals.user.contact_number,
            payment_method: req.body.payment_method,
            img_name: req.file.filename,
            image: {
                data: fs.readFileSync('uploads/' + req.file.filename),
                contentType: 'image/png'
            }
        })
        order.save()
    }
    res.redirect('/user/product')
})

router.route('/about')
.get((req, res) => {
    res.render('user/about')
})

// / user/faqs1
router.route('/faqs1')
.get((req, res) => {
    res.render('user/faqs/faqs1')
})
router.route('/faqs2')
.get((req, res) => {
    res.render('user/faqs/faqs2')
})
router.route('/faqs3')
.get((req, res) => {
    res.render('user/faqs/faqs3')
})
router.route('/faqs4')
.get((req, res) => {
    res.render('user/faqs/faqs4')
})

module.exports = router;