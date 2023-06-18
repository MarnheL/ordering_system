const express = require('express');
const router = express.Router();
const cookieParser = require('cookie-parser');
router.use(cookieParser());

const multer = require('multer');
const path = require('path');
const fs = require('fs')
const moment = require('moment')

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

// models / database
const Product = require('../models/Product')
const Order = require('../models/Order')
const ShoppingCart = require('../models/Shopping_Cart');
const Account = require('../models/Account')
const Sales = require('../models/Sales_Report')

// account authentication
const { adminAuth, checkAdmin } = require('../middleware/auth');

router.get('/*', adminAuth);
router.get('/*', checkAdmin);
router.post('/*', checkAdmin);

router.route('/dashboard')
.get(async(req, res) => {
    const order = await Order.find({status: 'delivered'}).populate('items')
    const sales = await Sales.find()
    let total_sales = 0
    if(order){
        order.forEach(data => {
            total_sales = total_sales + data.sub_total
        })
    }if(sales){
        sales.forEach(data => {
            total_sales = total_sales + data.sub_total
        })
    }
    // console.log(order)
    const product = await Product.find({isArchive: false})
    res.render('admin/dashboard', {total_sales, product})
})

router.route('/dashboard/accounts')
.get(async(req, res) => {
    const order = await Order.find({status: 'delivered'}).populate('items')
    const sales = await Sales.find()
    let total_sales = 0
    if(order){
        order.forEach(data => {
            total_sales = total_sales + data.total_amount
        })
    }
    if(sales){
        sales.forEach(data => {
            total_sales = total_sales + data.sub_total
        })
    }
    // console.log(order)
    const account = await Account.find({accountType: 'user'})
    res.render('admin/dashboard_account', {total_sales, account})
})

router.route('/inventory')
.get(async(req, res) => {
    const renderProduct = await Product.find({isArchive: false});
    res.render('admin/inventory', {renderProduct})
})

const Category = require('../models/Category')

router.route('/inventory/add-product')
.get(async(req, res) => {
    const cart = await ShoppingCart.find()
    res.render('admin/add_product')
})
.post(upload.single('image'), async(req, res) => {
    const { product_name, product_price, product_category, product_stocks } = req.body;
    const create = await Product({
        product_name: product_name,
        product_price: product_price,
        product_category: product_category,
        product_stock: product_stocks,
        img_name: req.file.filename,
        image: {
            data: fs.readFileSync('uploads/' + req.file.filename),
            contentType: 'image/png'
        }
    })
    create.save()
    .then(async(result) => {
        console.log(`${create} is successfully created`)
        console.log(create.product_category)
        const cat = await Category.findOne({category: create.product_category})
        console.log(cat)
        if(cat == null){
            const category = await Category({
                category: create.product_category
            })
            category.save()
        }
        res.redirect('/admin/inventory')
    })
    .catch(err => {
        console.log(err.message)
    })
})

router.route('/archive')
.get(async(req,res) => {
    const product = await Product.find({isArchive: true})
    res.render('admin/archive', {product})
})

router.route('/archive/:id/restore')
.post(async(req, res) => {
    const id = req.params.id;
    const archive = await Product.findByIdAndUpdate(id, {isArchive: false}, {new:true})
    res.redirect('/admin/archive')
})

router.route('/archive/:id/delete')
.post(async(req, res) => {
    const id = req.params.id;
    const archive = await Product.findByIdAndDelete(id)
    console.log(archive.product_category)
    const checCat = await Product.findOne({product_category: archive.product_category})
    console.log(checCat)
    if(checCat == null){
        await Category.findOneAndDelete({category: archive.product_category})
    }
    res.redirect('/admin/archive')
})

router.route('/inventory/:id/view-product')
.get(async(req, res) => {
    const id = req.params.id;
    const item = await Product.findById(id)
    // console.log(item)
    res.render('admin/view_product', {item})
})

router.route('/inventory/:id/archive')
.get(async(req, res) => {
    const id = req.params.id;
    const archive = await Product.findByIdAndUpdate(id, {isArchive: true}, {new:true})
    console.log(archive.isArchive)
    res.redirect('/admin/inventory')
})

// router.route('/inventory/:id/archive')
// .post(async(req, res) => {
//     const id = req.params.id;
//     const archive = await Product.findByIdAndUpdate(id, {isArchive: true}, {new:true})
//     console.log(archive.isArchive)
//     res.redirect('/admin/inventory')
// })

router.route('/inventory/:id/update-product')
.get(async(req, res) => {
    const id = req.params.id;
    const item = await Product.findById(id)
    console.log(item.product_name)
    res.render('admin/update_product', {item})
})

router.route('/inventory/:id/update-product-info')
.patch(async(req, res) => {
    const id = req.params.id;
    const options = {new: true};
    const {product_name, product_price, product_category, product_stocks} = req.body;
    const item = await Product.findById(id)
    try {
        const update_product = await Product.findByIdAndUpdate(id, {
            product_name: product_name,
            product_price: product_price,
            product_category: product_category,
            product_stock: product_stocks,
        }, options);
        res.redirect('/admin/inventory')
    } catch (error) {
        console.log(error.message)
        res.redirect('/admin/inventory')
    }
})

router.route('/inventory/:id/update-product-image')
.patch(upload.single('image'), async(req, res) => {
    const id = req.params.id;
    const options = {new: true};
    try {
        const update_product = await Product.findByIdAndUpdate(id, {
            img_name: req.file.filename,
            image: {
                data: fs.readFileSync('uploads/' + req.file.filename),
                contentType: 'image/png'
            }
        }, options);
        console.log(update_product.img_name)
        const cart = await ShoppingCart.find()
        cart.forEach(data => {
            let itemIndex = data.items.findIndex(p => p.product_id == id)
            if(itemIndex > -1){
                console.log(data.items[itemIndex].product_image)
                data.items[itemIndex].product_image = update_product.img_name;
            }
            data.save()
            .then(() => console.log(data))
        })
        res.redirect('/admin/inventory')
    } catch (error) {
        console.log(error.message)
        res.redirect('/admin/inventory')
    }
})

const Remove_Item = require('../models/Remove_Item')

router.route('/inventory/:id/remove-item')
.post(async(req, res) => {
    const id = req.params.id;
    const {reason, quantity, password} = req.body
    const product = await Product.findById(id)
    if(password == res.locals.user.password){
        const remove = await Product.findByIdAndUpdate(id, {
            $inc: {product_stock: -quantity}
        }, {new: true})
        const removeItem = await Remove_Item({
            product_name: product.product_name,
            product_price: product.product_price,
            product_category: product.product_category,
            current_stock: product.product_stock,
            product_quantity: quantity,
            updated_stock: product.product_stock - quantity,
            reason: reason,
            img_name: remove.img_name,
            image: remove.image,
        })
        removeItem.save()
        console.log('successfully remove item')
    }else{
        console.log('cannot remove item')
    }
    res.redirect('/admin/inventory')
})

router.route('/inventory/:id/sell-item')
.post(async(req, res) => {
    const id = req.params.id
    const {quantity, reason} = req.body
    // console.log(quantity, reason)
    const product = await Product.findById(id)
    const remove = await Product.findByIdAndUpdate(id, {
        $inc: {product_stock: -quantity}
    }, {new: true})
    console.log(remove.product_id)
    const removeItem = await Remove_Item({
        product_name: product.product_name,
        product_price: product.product_price,
        product_category: product.product_category,
        current_stock: product.product_stock,
        product_quantity: quantity,
        updated_stock: product.product_stock - quantity,
        reason: reason,
        img_name: remove.img_name,
        image: remove.image,
    })
    removeItem.save()
    const sales = await Sales({
        product_id: remove.id,
        product_name: remove.product_name,
        sub_total: remove.product_price * quantity,
        product_quantity: quantity,
    })
    sales.save()
    console.log(sales)
    res.redirect('/admin/inventory')
})

// display all pending order
router.route('/order-status')
.get(async(req, res) => {
    const order = await Order.find({status: 'pending'})
    res.render('admin/order_status', {order})
})

router.route('/order-status/:id')
.get(async(req, res) => {
    try {
        const id = req.params.id
        const order = await Order.findById(id)
        const image_url = order.img_name
        res.render('admin/image', {image_url})
    } catch (error) {
        res.send('server error')
    }
})

// approve pending order
router.route('/order-status/:id/ongoing')
.get(async(req, res) => {
    const id = req.params.id
    const order = await Order.findByIdAndUpdate(id, {status: 'to ship'}, {new: true})
    order.items.forEach(async (data) => {
        let product = await Product.findById(data.product_id)
        if(product){
            const remove = new Remove_Item({
                product_name: product.product_name,
                product_price: product.product_price,
                product_category: product.product_category,
                current_stock: product.product_stock,
                product_quantity: data.quantity,
                updated_stock: product.product_stock - data.quantity,
                reason: 'Online',
                img_name: product.img_name,
                image: product.image,
            })
            // console.log('found');
            remove.save()
            product.product_stock = product.product_stock - data.quantity;
            product.save()
            // .then(() => console.log(product))
        }
    })
    res.redirect('/admin/order-status')
})
// cancel pending order
// router.route('/order-status/:id/cancel')
// .get(async(req, res) => {
//     const id = req.params.id
//     const order = await Order.findByIdAndUpdate(id, {status: 'cancelled'}, {new: true})
//     res.redirect('/admin/order-status')
// })

router.route('/order-status/:id/cancel')
.post(async(req, res) => {
    const id = req.params.id
    const reason = `${req.body.reason}: ${req.body.other}`
    const order = await Order.findByIdAndUpdate(id, {status: 'cancelled', reason}, {new: true})
    res.redirect('/admin/order-status')
})

// display ongoing  order
router.route('/ongoing-order')
.get(async(req, res) => {
    const order = await Order.find({status: 'to ship'})
    res.render('admin/ongoing_order', {order})
})
// proceed order to ongoing
// router.route('/order-status/:id/ongoing')
// .get(async(req, res) => {
//     const id = req.params.id
//     const order = await Order.findByIdAndUpdate(id, {status: 'ongoing'}, {new: true})
//     res.redirect('/admin/approve-order')
// })

// proceed order to out fordelivery
router.route('/order-status/:id/out-for-delivery')
.get(async(req, res) => {
    const id = req.params.id
    const order = await Order.findByIdAndUpdate(id, {status: 'out for delivery'}, {new: true})
    res.redirect('/admin/ongoing-order')
})

router.route('/out-for-delivery')
.get(async(req, res) => {
    const order = await Order.find({status: 'out for delivery'})
    res.render('admin/out_for_delivery', {order})
})

router.route('/order-status/:id/completed-order')
.get(async(req, res) => {
    const id = req.params.id
    const order = await Order.findByIdAndUpdate(id, {status: 'delivered'}, {new: true})
    res.redirect('/admin/out-for-delivery')
})

router.route('/completed-order')
.get(async(req, res) => {
    const order = await Order.find({status: 'delivered', isFinish: false})
    res.render('admin/completed_order', {order})
    
})

router.route('/order-status/:id/finish')
.get(async(req, res) => {
    const id = req.params.id
    const order = await Order.findByIdAndUpdate(id, {isFinish: true}, {new: true})
    res.redirect('/admin/completed-order')
  
})

router.route('/completed-order/history')
.get(async(req, res) => {
    const order = await Order.find({isFinish: true}).sort({createdAt: -1})
    res.render('admin/completed', {order})
})

router.route('/cancelled-order')
.get(async(req, res) => {
    const account = await Account.find()
    console.log(account)
    const order = await Order.find({status: 'cancelled'}).sort({createdAt: -1})
    res.render('admin/cancelled_order', {order})
})


router.route('/sales-report')
.get(async(req, res) => {
    try {
        let start = moment(req.query.start).add(1, 'days')
        let end = moment(req.query.end).add(1, 'days')
        let order;
        let sales;
        if(req.query.start == undefined && req.query.end == undefined){
            order = await Order.find({status: 'delivered'}).populate('items')
            sales = await Sales.find()
        }else{
            order = await Order.find({createdAt: {$gte: start.toDate(), $lte: end.toDate()}, status: {$nin: ['pending', 'cancelled']}}).populate('items')
            sales = await Sales.find({createdAt: {$gte: start.toDate(), $lte: end.toDate()}})
        }
        console.log(sales)
        let total_sales = 0
        if(order){
            order.forEach(data => {
                total_sales = total_sales + data.sub_total
            })
        }
        if(sales){
            sales.forEach(data => {
                total_sales = total_sales + data.sub_total
            })
        }
        res.render('admin/sales_report', {total_sales, order, sales})
    } catch (error) {
        res.send('server error')
    }
})

router.route('/inventory-report')
.get(async(req, res) => {
    const search = req.query.result
    let report;
    if(search){
        report = await Remove_Item.find({
            $or: [
                {reason: {$regex: search}}
            ]
        })
    }else{
        report = await Remove_Item.find()
    }
    res.render('admin/inventory_report', {report})
})

router.route('/accounts')
.get(async(req, res) => {
    const account = await Account.find({accountType: {$ne: 'admin'}})
    res.render('admin/accounts', {account})
})

router.route('/accounts/:id/delete')
.get(async(req, res) => {
    const id = req.params.id
    const user = await Account.findByIdAndDelete(id)
    res.redirect('/admin/accounts')
})

router.route('/logout')
.post((req, res) => {
    res.cookie('admin_id', '', {maxAge: 1})
    console.log('logout successfully')
    res.redirect('/admin/login')
})

module.exports = router;