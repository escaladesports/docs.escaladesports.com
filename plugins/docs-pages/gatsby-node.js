const { createFilePath } = require('gatsby-source-filesystem')
const { resolve } = require('path')
const crypto = require('crypto')
const cwd = process.cwd()

exports.createPages = async ({ graphql, boundActionCreators }) => {
	const { createPage, createNode } = boundActionCreators
	const component = resolve(`./src/templates/default.js`)
	let res
	try{
		res = await graphql(`{
			allMarkdownRemark(filter: {
				fileAbsolutePath: { regex: "${cwd}/docs/" }
			}){
				edges{
					node{
						id
						html
						fileAbsolutePath
						fields{
							slug
							order
							title
						}
					}
				}
			}
		}`)
	}
	catch(err){
		console.error(err)
		process.exit(1)
	}
	if(res.errors){
		console.error(res.errors)
		process.exit(1)
	}

	let pages = res.data.allMarkdownRemark.edges
	let categories = createCategories(pages)
	let flatCategories = flattenCategories(categories)

	let jsonCategories = {
		json: JSON.stringify(categories)
	}
	createNode(Object.assign({
		id: `docsSchema`,
		parent: null,
		children: [],
		internal: {
			type: `DocsSchema`,
			contentDigest: crypto
				.createHash('md5')
				.update(JSON.stringify(jsonCategories))
				.digest('hex')
		}
	}, jsonCategories))

	pages.forEach((obj) => {
		obj = obj.node
		let { slug } = obj.fields
		let previous
		let next
		flatCategories.forEach((cat, key) => {
			if (cat.slug === slug || `${cat.slug}/` == slug) {
				if(key > 0){
					previous = flatCategories[key - 1]
				}
				if(key < flatCategories.length - 1){
					next = flatCategories[key + 1]
				}
			}
		})
		let fileName = obj.fileAbsolutePath.replace(cwd, ``)
		console.log(fileName)

		createPage({
			path: slug,
			component,
			context: {
				fileName,
				slug,
				previous,
				next,
			},
		})
	})
}

function flattenCategories(arr, res = []){
	arr.forEach(item => {
		res.push({
			slug: item.slug,
			title: item.title,
		})
		if (item.contents.length) {
			flattenCategories(item.contents, res)
		}
	})
	return res
}

function createCategories(pages) {
	const categories = []
	const paths = []
	const slugs = []
	const titles = {}
	pages.forEach(page => {
		let slug = page.node.fields.slug.split(`/`)
		slug.shift()
		slug.pop()
		slug.push(page.node.fields.order)
		slugs.push(slug)
		titles[slug.join(`/`)] = page.node.fields.title
	})
	slugs.sort((a, b) => {
		if(a.length > b.length) return 1
		if(a.length < b.length) return -1
		let orderA = a[a.length - 1]
		let orderB = b[b.length - 1]
		if(orderA > orderB) return 1
		if(orderA < orderB) return -1
		return 0
	})

	// Add index
	//let title = titles[slugs[0].join(`/`)]
	//slugs[0].pop()
	//let origSlug = `/${slugs[0].join(`/`)}`

	//slugs.shift()
	slugs.forEach(slug => {
		let title = titles[slug.join(`/`)]
		let cursor = categories
		slug.pop()
		let origSlug = `/${slug.join(`/`)}`
		let path = slug.pop()
		slug.forEach(dir => {
			cursor = findPath(cursor, dir)
		})
		cursor.push({
			path,
			slug: origSlug,
			title,
			contents: [],
		})
	})
	return categories
}

function findPath(arr, path){
	for(let i = 0; i < arr.length; i++){
		if(arr[i].path === path){
			return arr[i].contents
		}
	}
}


exports.onCreateNode = ({ node, boundActionCreators, getNode }) => {
	const { createNodeField } = boundActionCreators

	if (
		node.internal.type === `MarkdownRemark` &&
		node.fileAbsolutePath.replace(cwd, ``).indexOf(`/docs/`) === 0
	) {
		let value = createFilePath({ node, getNode })
		let obj = removeFirstNumbers(value)
		value = obj.str
		let content = node.internal.content.split(`\n`)
		let title = `Untitled Document`
		for(let i = 0; i < content.length; i++){
			if(content[i].indexOf(`#`) === 0){
				title = content[i].split(` `)
				title.shift()
				title = title.join(` `)
				break
			}
		}
		createNodeField({
			name: `slug`,
			node,
			value,
		})
		createNodeField({
			name: `type`,
			node,
			value: `doc`,
		})
		createNodeField({
			name: `title`,
			node,
			value: title,
		})
		createNodeField({
			name: `order`,
			node,
			value: obj.lastNum - 1,
		})
	}
}

function removeFirstNumbers(str){
	str = str.split(`/`)
	let lastNum = 0
	str = str.map(dir => {
		if (dir.indexOf(`-`) > 0){
			dir = dir.split(`-`)
			if(!isNaN(dir[0])){
				lastNum = Number(dir[0])
				dir.shift()
			}
			dir = dir.join(`-`)
		}
		return dir
	})
	str = str.join(`/`)
	return {
		lastNum,
		str,
	}
}