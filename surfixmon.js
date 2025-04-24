// Fixi
(_=>{
	if(document.__fixi_mo) return
	document.__fixi_mo = new MutationObserver((recs)=>recs.forEach((r)=>r.type === "childList" && r.addedNodes.forEach((n)=>process(n))))
	let send = (elt, type, detail, bub)=>elt.dispatchEvent(new CustomEvent("fx:" + type, {detail, cancelable:true, bubbles:bub !== false, composed:true}))
	let attr = (elt, name, defaultVal)=>elt.getAttribute(name) || defaultVal
	let ignore = (elt)=>elt.closest("[fx-ignore]") != null
	let init = (elt)=>{
		let options = {}
		if (elt.__fixi || ignore(elt) || !send(elt, "init", {options})) return
		elt.__fixi = async(evt)=>{
			let reqs = elt.__fixi.requests ||= new Set()
			let form = elt.form || elt.closest("form") || elt.closest("tr")
			let body = new FormData(form ?? undefined, evt.submitter)
			if (!form && elt.name) body.append(elt.name, elt.value)
			if (form.tagName == 'TR') {
				for (const cell of row.cells){
					const name = cell.getAttribute('name')
					if(name) e.detail.cfg.body.append(name, cell.innerText.trim())
				}
			}
			if (!['file','image'].includes(elt.type) && !form?.querySelector('input[type="file"], input[type="image"]')) body = new URLSearchParams(body)
			let ac = new AbortController()
			let cfg = {
				trigger:evt,
				action:attr(elt, "fx-action", ""),
				method:attr(elt, "fx-method")?.toUpperCase(),
				target:document.querySelector(attr(elt, "fx-target")) ?? elt,
				swap:attr(elt, "fx-swap", "innerHTML"),
				body,
				drop:reqs.size,
				headers:{"FX-Tag":elt.tagName,"FX-Id":elt.id},
				abort:ac.abort.bind(ac),
				signal:ac.signal,
				preventTrigger:true,
				transition:document.startViewTransition?.bind(document),
				fetch:fetch.bind(window)
			}
			let go = send(elt, "config", {cfg, requests:reqs})
			if (cfg.preventTrigger) evt.preventDefault()
			if (!go || cfg.drop) return
			if (/GET|DELETE/.test(cfg.method)){
				if (cfg.body.size) cfg.action += (/\?/.test(cfg.action) ? "&" : "?") + cfg.body
				cfg.body = null
			}
			reqs.add(cfg)
			try {
				if (cfg.confirm){
					let result = await cfg.confirm()
					if (!result) return
				}
				if (!send(elt, "before", {cfg, requests:reqs})) return
				cfg.response = await cfg.fetch(cfg.action, cfg)
				cfg.text = await cfg.response.text()
				if (!send(elt, "after", {cfg})) return
			} catch(error) {
				send(elt, "error", {cfg, error})
				return
			} finally {
				reqs.delete(cfg)
				send(elt, "finally", {cfg})
			}
			let doSwap = _=>{
				if (cfg.swap instanceof Function) return cfg.swap(cfg)
				else if (/(before|after)(begin|end)/.test(cfg.swap)) cfg.target.insertAdjacentHTML(cfg.swap, cfg.text)
				else if(cfg.swap in cfg.target) cfg.target[cfg.swap] = cfg.text
				else throw cfg.swap
			}
			if (cfg.transition) await cfg.transition(doSwap).finished
			else await doSwap()
			send(elt, "swapped", {cfg})
			if (!document.contains(elt)) send(document, "swapped", {cfg})
		}
		elt.__fixi.evt = attr(elt, "fx-trigger", elt.matches("form") ? "submit" : elt.matches("input:not([type=button]),select,textarea") ? "change" : "click").split("|")
		elt.__fixi.evt.forEach(a=>{elt.addEventListener(a, elt.__fixi, options)})
		send(elt, "inited", {}, false)
	}
	let process = (n)=>{
		if (n.matches){
			if (ignore(n)) return
			if (n.matches("[fx-method]")) init(n)
		}
		if(n.querySelectorAll) n.querySelectorAll("[fx-method]").forEach(init)
	}
	document.addEventListener("fx:process", (evt)=>process(evt.target))
	document.addEventListener("DOMContentLoaded", ()=>{
		document.__fixi_mo.observe(document.documentElement, {childList:true, subtree:true})
		process(document.body)
	})
})()

document.addEventListener('fx:init',e=>{//Disable During Request
	const el = e.target
	if(!el.matches('[fx-disable]')) return
	const disableSelector = el.getAttribute('fx-disable')
	el.addEventListener('fx:before',_=>{
		let disableTarget = disableSelector == "" ? el : document.querySelector(disableSelector)
		disableTarget.disabled = true
		el.addEventListener('fx:after', (afterEvt)=>{if(afterEvt.target == el) disableTarget.disabled = false})
	})
})

document.addEventListener('fx:config',e=>{//Confirm Dialog
	const confirmationMessage = e.target.getAttribute('fx-confirm')
	if(confirmationMessage) e.detail.cfg.confirm =_=>confirm(confirmationMessage)
})

document.addEventListener('fx:init',e=>{//Debounce
	let target = e.target
	if (!target.hasAttribute('fx-debounce')) return
	target.addEventListener('fx:inited', _=>{
		target.removeEventListener(target.__fixi.evt, target.__fixi)
		let debounceTime = parseInt(target.getAttribute('fx-debounce'))
		let timeout = null
		target.addEventListener(target.__fixi.evt,e=>{
			clearTimeout(timeout)
			timeout = setTimeout(_=>target.__fixi(e), debounceTime)
		})
	})
})

document.addEventListener('fx:config',e=>{//Relative Selectors
	const target = e.target.getAttribute('fx-target') || ""
	if(target.indexOf('closest ') == 0) e.detail.cfg.target = e.target.closest(target.substring(8))
	else if(target.indexOf('find ') == 0) e.detail.cfg.target = e.target.closest(target.substring(5))
	else if(target.indexOf('next ') == 0){
		const matches = Array.from(document.querySelectorAll(target.substring(5)))
		e.detail.cfg.target = matches.find((el)=>e.target.compareDocumentPosition(el) === Node.DOCUMENT_POSITION_FOLLOWING)
	} else if(target.indexOf('previous ') == 0){
		const matches = Array.from(document.querySelectorAll(target.substring(9))).reverse()
		e.detail.cfg.target = matches.find((el)=>e.target.compareDocumentPosition(el) === Node.DOCUMENT_POSITION_PRECEDING)
	}
})

document.addEventListener('fx:config',e=>{//Vals
	if(!e.target.matches('[fx-vals]')) return
	const valsAttr = e.target.getAttribute('fx-vals')
	let vals
	if(valsAttr.startsWith('js:')) vals = new Function('return ' + valsAttr.slice(3))()
	else vals = new Function('return ' + valsAttr)()
	if(typeof vals !== 'object' || vals === null || Array.isArray(vals)){
		console.error('fx-vals not a valid object:', vals);return
	}
	for (let key in vals){
		if(typeof key === 'string' && key.trim() === '') continue
		e.detail.cfg.body.append(key, vals[key])
	}
})

document.addEventListener('fx:before',_=>{//Clear Error & Success
	me('#error').textContent = me('#success').textContent = ''
})

document.addEventListener('fx:after',e=>{//Set Error & Success
	if(e.detail.cfg.response.status < 400) setTimeout(_=>{me('#success').textContent = ''}, 2000)
	else {e.detail.cfg.target = me('#error');e.detail.cfg.swap = 'innerHTML'}
})

document.addEventListener('fx:finally',e=>{//Refresh
	if(!e.target.matches('[fx-refresh]')) return
	document.location.reload()
})

document.addEventListener('fx:swapped',e=>{//Run Scripts then Create Icons
	e.detail.cfg.target.querySelectorAll('script').forEach(s=>
		s.replaceWith(Object.assign(document.createElement('script'),{textContent:s.textContent}))
	)
	if(lucide) lucide.createIcons()
})

document.addEventListener('mousedown',e=>{//fclick
	if(e.button || !e.target.closest('[fclick]')) return
	e.preventDefault();e.target.click()
})
document.addEventListener('touchstart',e=>{
	if(!e.target.closest('[fclick]')) return
	e.preventDefault();e.target.click()
})

// Welcome to Surreal 1.3.2
// Documentation: https://github.com/gnat/surreal
// Locality of Behavior (LoB): https://htmx.org/essays/locality-of-behaviour/
let surreal = (function () {
let $ = { // Convenience for internals.
	$: this, // Convenience for internals.
	plugins: [],

	// Table of contents and convenient call chaining sugar. For a familiar "jQuery like" syntax. 🙂
	// Check before adding new: https://youmightnotneedjquery.com/
	sugar(e) {
		if (!$.isNode(e) && !$.isNodeList(e)) { console.warn(`Surreal: Not a supported element / node / node list "${e}"`); return e }
		if ($.isNodeList(e)) e.forEach(_ => { $.sugar(_) }) // Add Surreal to all nodes from any()
		if (e.hasOwnProperty('hasSurreal')) return e // Surreal already added.

		// General
		e.run           = (f) => { return $.run(e, f) }
		e.remove        = () => { return $.remove(e) }

		// Classes and CSS.
		e.classAdd      = (name) => { return $.classAdd(e, name) }
		e.class_add     = e.add_class = e.addClass = e.classAdd // Alias
		e.classRemove   = (name) => { return $.classRemove(e, name) }
		e.class_remove  = e.remove_class = e.removeClass = e.classRemove // Alias
		e.classToggle   = (name, force) => { return $.classToggle(e, name, force) }
		e.class_toggle  = e.toggle_class = e.toggleClass = e.classToggle // Alias
		e.styles        = (value) => { return $.styles(e, value) }

		// Events.
		e.on            = (name, f) => { return $.on(e, name, f) }
		e.off           = (name, f) => { return $.off(e, name, f) }
		e.offAll        = (name) => { return $.offAll(e, name) }
		e.off_all       = e.offAll // Alias
		e.disable       = () => { return $.disable(e) }
		e.enable        = () => { return $.enable(e) }
		e.send          = (name, detail) => { return $.send(e, name, detail) }
		e.trigger       = e.send // Alias
		e.halt          = (ev, keepBubbling, keepDefault) => { return $.halt(ev, keepBubbling, keepDefault) }

		// Attributes.
		e.attribute 	= (name, value) => { return $.attribute(e, name, value) }
		e.attributes    = e.attr = e.attribute // Alias

		// Add all plugins.
		$.plugins.forEach(function(func) { func(e) })

		e.hasSurreal = 1
		return e
	},
	// me() will return a single element or null. Selector not needed if used with inline <script>
	// If you select many elements, me() will return the first.
	// Example
	//	<div>
	//		Hello World!
	//		<script>me().style.color = 'red'</script>
	//	</div>
	me(selector=null, start=document, warning=true) {
		if (selector == null) return $.sugar(start.currentScript.parentElement) // Just local me() in <script>
		if (selector instanceof Event) return selector.currentTarget ? $.me(selector.currentTarget) : (console.warn(`Surreal: Event currentTarget is null. Please save your element because async will lose it`), null) // Events try currentTarget
		if (selector === '-' || selector === 'prev' || selector === 'previous') return $.sugar(start.currentScript.previousElementSibling) // Element directly before <script>
		if ($.isSelector(selector, start, warning)) return $.sugar(start.querySelector(selector)) // String selector.
		if ($.isNodeList(selector)) return $.me(selector[0]) // If we got a list, return the first element.
		if ($.isNode(selector)) return $.sugar(selector) // Valid element.
		return null // Invalid.
	},
	// any() is me() but will return an array of elements or empty [] if nothing is found.
	// You may optionally use forEach/map/filter/reduce.
	// Example: any('button')
	any(selector, start=document, warning=true) {
		if (selector == null) return $.sugar([start.currentScript.parentElement]) // Similar to me()
		if (selector instanceof Event) return selector.currentTarget ? $.any(selector.currentTarget) : (console.warn(`Surreal: Event currentTarget is null. Please save your element because async will lose it`), null) // Events try currentTarget
		if (selector === '-' || selector === 'prev' || selector === 'previous') return $.sugar([start.currentScript.previousElementSibling]) // Element directly before <script>
		if ($.isSelector(selector, start, warning)) return $.sugar(Array.from(start.querySelectorAll(selector))) // String selector.
		if ($.isNode(selector)) return $.sugar([selector]) // Single element. Convert to Array.
		if ($.isNodeList(selector)) return $.sugar(Array.from(selector)) // Valid NodeList or Array.
		return $.sugar([]) // Invalid.
	},
	// Run any function on element(s)
	run(e, f) {
		if (typeof f !== 'function') { console.warn(`Surreal: run(f) f must be a function`); return e }
		if ($.isNodeList(e)) e.forEach(_ => { $.run(_, f) })
		if ($.isNode(e)) { f(e); }
		return e
	},
	// Remove element(s)
	remove(e) {
		if ($.isNodeList(e)) e.forEach(_ => { $.remove(_) })
		if ($.isNode(e)) e.parentNode.removeChild(e)
		return // Special, end of chain.
	},
	// Add class to element(s).
	classAdd(e, name) {
		if (typeof name !== 'string') return e
		if (name.charAt(0) === '.') name = name.substring(1)
		if ($.isNodeList(e)) e.forEach(_ => { $.classAdd(_, name) })
		if ($.isNode(e)) e.classList.add(name)
		return e
	},
	// Remove class from element(s).
	classRemove(e, name) {
		if (typeof name !== 'string') return e
		if (name.charAt(0) === '.') name = name.substring(1)
		if ($.isNodeList(e)) e.forEach(_ => { $.classRemove(_, name) })
		if ($.isNode(e)) e.classList.remove(name)
		return e
	},
	// Toggle class in element(s).
	classToggle(e, name, force) {
		if (typeof name !== 'string') return e
		if (name.charAt(0) === '.') name = name.substring(1)
		if ($.isNodeList(e)) e.forEach(_ => { $.classToggle(_, name, force) })
		if ($.isNode(e)) e.classList.toggle(name, force)
		return e
	},
	// Add inline style to element(s).
	// Can use string or object formats.
	// 	String format: "font-family: 'sans-serif'"
	// 	Object format; { fontFamily: 'sans-serif', backgroundColor: '#000' }
	styles(e, value) {
		if (typeof value === 'string') { // Format: "font-family: 'sans-serif'"
			if ($.isNodeList(e)) e.forEach(_ => { $.styles(_, value) })
			if ($.isNode(e)) { $.attribute(e, 'style', ($.attribute(e, 'style') == null ? '' : $.attribute(e, 'style') + '; ') + value)  }
			return e
		}
		if (typeof value === 'object') { // Format: { fontFamily: 'sans-serif', backgroundColor: '#000' }
			if ($.isNodeList(e)) e.forEach(_ => { $.styles(_, value) })
			if ($.isNode(e)) { Object.assign(e.style, value)  }
			return e
		}
		return e
	},
	// Add event listener to element(s).
	// Match a sender: if (!event.target.matches(".selector")) return;
	//	📚️ https://developer.mozilla.org/en-US/docs/Web/API/Event
	//	✂️ Vanilla: document.querySelector(".thing").addEventListener("click", (e) => { alert("clicked") }
	on(e, name, f) {
		if ($.isNodeList(e)) e.forEach(_ => { $.on(_, name, f) })
		if ($.isNode(e)) e.addEventListener(name, f)
		return e
	},
	off(e, name, f) {
		if ($.isNodeList(e)) e.forEach(_ => { $.off(_, name, f) })
		if ($.isNode(e)) e.removeEventListener(name, f)
		return e
	},
	offAll(e) {
		if ($.isNodeList(e)) e.forEach(_ => { $.offAll(_) })
		if ($.isNode(e)) e.parentNode.replaceChild(e.cloneNode(true), e)
		return e
	},
	// Easy alternative to off(). Disables click, key, submit events.
	disable(e) {
		if ($.isNodeList(e)) e.forEach(_ => { $.disable(_) })
		if ($.isNode(e)) e.disabled = true
		return e
	},
	// For reversing disable()
	enable(e) {
		if ($.isNodeList(e)) e.forEach(_ => { $.enable(_) })
		if ($.isNode(e)) e.disabled = false
		return e
	},
	// Send / trigger event.
	// ✂️ Vanilla: Events Dispatch: document.querySelector(".thing").dispatchEvent(new Event('click'))
	send(e, name, detail=null) {
		if ($.isNodeList(e)) e.forEach(_ => { $.send(_, name, detail) })
		if ($.isNode(e)) {
			const event = new CustomEvent(name, { detail: detail, bubbles: true })
			e.dispatchEvent(event)
		}
		return e
	},
	// Halt event. Default: Stops normal event actions and event propagation.
	halt(ev, keepBubbling=false, keepDefault=false) {
		if (ev instanceof Event) {
			if (!keepDefault) ev.preventDefault()
			if (!keepBubbling) ev.stopPropagation()
		}
		return ev
	},
	// Add or remove attributes from element(s)
	attribute(e, name, value=undefined) {
		// Get. (Format: "name", "value") Special: Ends call chain.
		if (typeof name === 'string' && value === undefined) {
			if ($.isNodeList(e)) return [] // Not supported for Get. For many elements, wrap attribute() in any(...).run(...) or any(...).forEach(...)
			if ($.isNode(e)) return e.getAttribute(name)
			return null // No value. Ends call chain.
		}
		// Remove.
		if (typeof name === 'string' && value === null) {
			if ($.isNodeList(e)) e.forEach(_ => { $.attribute(_, name, value) })
			if ($.isNode(e)) e.removeAttribute(name)
			return e
		}
		// Add / Set.
		if (typeof name === 'string') {
			if ($.isNodeList(e)) e.forEach(_ => { $.attribute(_, name, value) })
			if ($.isNode(e)) e.setAttribute(name, value)
			return e
		}
		// Format: { "name": "value", "blah": true }
		if (typeof name === 'object') {
			if ($.isNodeList(e)) e.forEach(_ => { Object.entries(name).forEach(([key, val]) => { $.attribute(_, key, val) }) })
			if ($.isNode(e)) Object.entries(name).forEach(([key, val]) => { $.attribute(e, key, val) })
			return e
		}
		return e
	},
	// Puts Surreal functions except for "restricted" in global scope.
	globalsAdd() {
		console.log(`Surreal: Adding convenience globals to window.`)
		let restricted = ['$', 'sugar']
		for (const [key, value] of Object.entries(this)) {
			if (!restricted.includes(key)) window[key] != 'undefined' ? window[key] = value : console.warn(`Surreal: "${key}()" already exists on window. Skipping to prevent overwrite.`)
			window.document[key] = value
		}
	},
	// ⚙️ Used internally. Is this an element / node?
	isNode(e) {
		return (e instanceof HTMLElement || e instanceof SVGElement || e instanceof Document) ? true : false
	},
	// ⚙️ Used internally by DOM functions. Is this a list of elements / nodes?
	isNodeList(e) {
		return (e instanceof NodeList || Array.isArray(e)) ? true : false
	},
	// ⚙️ Used internally by DOM functions. Warning when selector is invalid. Likely missing a "#" or "."
	isSelector(selector="", start=document, warning=true) {
		if (typeof selector !== 'string') return false
		if (start.querySelector(selector) == null) {
			if (warning) console.log(`Surreal: "${selector}" not found, ignoring.`)
			return false
		}
		return true // Valid.
	},
}
// Finish up...
$.globalsAdd() // Full convenience.
console.log("Surreal: Loaded.")
return $
})() // End of Surreal 👏

// 🔌 Plugin: Effects
function pluginEffects(e) {
	// Fade out and remove element.
	// Equivalent to jQuery fadeOut(), but actually removes the element!
	function fadeOut(e, f=undefined, ms=1000, remove=true) {
		let thing = e
		if (surreal.isNodeList(e)) e.forEach(_ => { fadeOut(_, f, ms) })
		if (surreal.isNode(e)) {
			(async() => {
				surreal.styles(e, {transform: 'scale(1)', transition: `all ${ms}ms ease-out`, overflow: 'hidden'})
				await tick()
				surreal.styles(e, {transform: 'scale(0.9)', opacity: '0'})
				await sleep(ms, e)
				if (typeof f === 'function') f(thing) // Run custom callback?
				if (remove) surreal.remove(thing) // Remove element after animation is completed?
			})()
		}
	}
	// Fade in an element that has opacity under 1
	function fadeIn(e, f=undefined, ms=1000) {
		let thing = e
		if (surreal.isNodeList(e)) e.forEach(_ => { fadeIn(_, f, ms) })
		if (surreal.isNode(e)) {
			(async() => {
				let save = e.style // Store original style.
				surreal.styles(e, {transition: `all ${ms}ms ease-in`, overflow: 'hidden'})
				await tick()
				surreal.styles(e, {opacity: '1'})
				await sleep(ms, e)
				e.style = save // Revert back to original style.
				surreal.styles(e, {opacity: '1'}) // Ensure we're visible after reverting to original style.
				if (typeof f === 'function') f(thing) // Run custom callback?
			})()
		}
	}
	// Add sugar
	e.fadeOut  = (f, ms, remove) => { return fadeOut(e, f, ms, remove) }
	e.fade_out = e.fadeOut
	e.fadeIn   = (f, ms) => { return fadeIn(e, f, ms) }
	e.fade_in  = e.fadeIn
}

// 🔌 Add plugins here!
surreal.plugins.push(pluginEffects)
console.log("Surreal: Added plugins.")

// 🌐 Add global shortcuts here!
// DOM.
const createElement = create_element = document.createElement.bind(document)
// Animation.
const rAF = typeof requestAnimationFrame !== 'undefined' && requestAnimationFrame
const rIC = typeof requestIdleCallback !== 'undefined' && requestIdleCallback
// Animation: Wait for next animation frame, non-blocking.
async function tick() {
	return await new Promise(resolve => { requestAnimationFrame(resolve) })
}
// Animation: Sleep, non-blocking.
async function sleep(ms, e) {
	return await new Promise(resolve => setTimeout(() => { resolve(e) }, ms))
}
// Loading: Why? So you don't clobber window.onload (predictable sequential loading)
// Example: <script>onloadAdd(() => { console.log("Page was loaded!") })</script>
// Example: <script>onloadAdd(() => { console.log("Lets do another thing without clobbering window.onload!") })</script>
const onloadAdd = addOnload = onload_add = add_onload = (f) => {
	if (typeof window.onload === 'function') { // window.onload already is set, queue functions together (creates a call chain).
		let onload_old = window.onload
		window.onload = () => {
			onload_old()
			f()
		}
		return
	}
	window.onload = f // window.onload was not set yet.
}
console.log("Surreal: Added shortcuts.")

//Common
let theme = localStorage.getItem('theme') || 'dark'
me("html").attr('data-theme', theme)

onloadAdd(_=>{lucide.createIcons()})

window.addEventListener('scroll', _=>{
		if (document.documentElement.scrollTop > 100) scroller.style.display = "block"
		else scroller.style.display = "none"
	}, {passive: true}
)

function oassign(tag, obj) {return Object.assign(document.createElement(tag), obj)}

function copyToClipboard(text) {
	if (navigator.clipboard && navigator.clipboard.writeText) {navigator.clipboard.writeText(text);return}
	const textarea = oassign('textarea')
	textarea.value = text
	document.body.appendChild(textarea)
	textarea.select()
	document.execCommand('copy')
	document.body.removeChild(textarea)
}

function exportTable(table, sep) {
	const rows = [...table.rows]
	const data = rows.filter(row => row.style.display !== 'none').map((row, index)=>[...row.cells].map(cell=>index=== 0?cell.innerText.slice(0, -2):cell.textContent))
	const blob = new Blob([data.map(row => row.join(sep)).join('\n')], {type: 'text/csv'})
	const a = oassign('a')
	a.href = URL.createObjectURL(blob)
	a.download = 'export.csv'
	a.click()
	URL.revokeObjectURL(a.href)
}

function searchTable(table, term) {
	const rows = [...table.rows].slice(1)
	rows.forEach((row)=>{
		const found = [...row.cells].some(cell=>{
			if (cell.getElementsByTagName('script').length > 0) return false
			return cell.textContent.includes(term)
		})
		row.style.display = found ? '' : 'none'
	})
}

function sortTable(head) {
	const arrow = head.textContent.substr(-1)
	const heads = head.parentElement
	const column = [...heads.cells].indexOf(head)
	const body = head.parentElement.parentElement
	const rowsArray = [...body.rows].slice(1)
	for (let e of heads.cells) {if (['►','▲','▼'].includes(e.textContent.substr(-1))) e.textContent=e.textContent.slice(0, -1) + '►'}
	if (arrow === '▼') {
		head.textContent = head.textContent.slice(0, -1) + '▲'
		rowsArray.sort((a, b)=>b.cells[column].textContent.localeCompare(a.cells[column].textContent, undefined, { numeric: true }))
	}
	else {
		head.textContent = head.textContent.slice(0, -1) + '▼'
		rowsArray.sort((a, b)=>a.cells[column].textContent.localeCompare(b.cells[column].textContent, undefined, { numeric: true }))
	}
	body.replaceChildren(heads, ...rowsArray)
}

function showType(show, head) {
	if (show) for (let i = 0; i < head.cells.length; i++) head.cells[i].innerHTML = head.cells[i].innerHTML.replace(/<span style="display: none;">\[(.*?)\]<\/span>/g, '[$1]')
	else for (let i = 0; i < head.cells.length; i++) head.cells[i].innerHTML = head.cells[i].innerHTML.replace(/\[(.*?)\]/g, '<span style="display: none;">[$1]</span>')
}

function generateKey() {
	const length = 32
	const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
	let key = ''
	for (let i = 0; i < length; i++) key += chars[Math.floor(Math.random() * chars.length)]
	return key
}

function watch(input, handler) {
	let timeout
	if (input !== Object(input)) input = {watch: input}
	return new Proxy(input, {
		set(target, property, value, receiver) {
			if (target[property] === value) return true
			const result = Reflect.set(target, property, value, receiver)
			clearTimeout(timeout)
			timeout = setTimeout(handler, 0, target)
			return result
		}
	})
}
