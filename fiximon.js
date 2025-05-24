// CLIENT
function $(s) { // s=selector, el=element, els=elements
	let el, els
	const start = document.currentScript // Doesn't work in callback use Event or QuerySelector
	if (!s) el = start.parentElement ?? console.warn('$(): Fails inside callback.')
	else if (s instanceof Event) el = s.currentTarget ?? console.warn(`$(${s}): Event is Null`)
	else if (typeof s !== 'string') {console.warn(`$(${s}): Not a String`); return null}
	else if (s == '-') el = start.previousElementSibling ?? console.warn('$(\'-\'): Fails inside callback.')
	else if (s.indexOf('closest ') == 0) el = start.closest(s.substring(8))
	else if (s.indexOf('next ') == 0){
		const matches = Array.from(document.querySelectorAll(s.substring(5)))
		el = matches.find((el)=>start.compareDocumentPosition(el) === Node.DOCUMENT_POSITION_FOLLOWING)
	}
	else if (s.indexOf('previous ') == 0){
		const matches = Array.from(document.querySelectorAll(s.substring(9))).reverse()
		el = matches.find((el)=>start.compareDocumentPosition(el) === Node.DOCUMENT_POSITION_PRECEDING)
	}
	if (el) els = [el]
	else {
		els = Array.from(document.querySelectorAll(s))
		if (els.length === 0) {console.warn(`$(${s}): QuerySelector is Null`); return null}
	}
	return { // e=event, c=callback, d=delay
		$: els[0],
		all: els,
		closest: (n)=>{return els[0].closest(n)},
		next: (n)=>{
			const matches = Array.from(document.querySelectorAll(n))
			return matches.find((e)=>els[0].compareDocumentPosition(e) === Node.DOCUMENT_POSITION_FOLLOWING)
		},
		previous: (n)=>{
			const matches = Array.from(document.querySelectorAll(n)).reverse()
			return matches.find((e)=>els[0].compareDocumentPosition(e) === Node.DOCUMENT_POSITION_PRECEDING)
		},
		nav: (nav)=>{
			el = els[0]
			for (const n of nav.split(' ')) {
				switch (n) {
					case 'parent': el = el.parentElement; break
					case 'next': el = el.nextElementSibling; break
					case 'previous': el = el.previousElementSibling; break
					case 'first': el = el.firstElementChild; break
					case 'last': el = el.lastElementChild; break
					default: console.warn(`$: Nav ${n} is not Valid`)
				}
			}
			return el
		},
		// Add more returns here
		on: (e, c)=>(els.forEach(el => el.addEventListener(e, c)),this),
		off: (e, c)=>(els.forEach(el => el.removeEventListener(e, c)), this),
		run: (c)=>(els.forEach(_=>f(c)), this),
		send: (name, detail, bubbles = true)=>(els.forEach(el => el.dispatchEvent(new CustomEvent(name, { detail, bubbles }))), this),
		onchil: (e, c)=>(Array.from(els[0].children).forEach(el => el.addEventListener(e, c)),this),
		// Add more chainables here
	}
}

function signal(init) {
	let value = init
	const subs = new Set()
	const sig = _=>{return value}
	sig.set = newValue=>{
		if (newValue === value) return
		value = newValue
		subs.forEach(sub=>sub(value))
	}
	sig.sub = cb=>{
		subs.add(cb)
		return _=>{subs.delete(cb)}
	}
	sig.clear = _=>{subs.clear()}
	return sig
}


// FIXI
;(_=>{
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
			let form = elt.form || elt.closest("form")
			let body = new FormData(form ?? undefined, evt.submitter)
			let tr = elt.closest("tr")
			if (tr?.tagName === 'TR') {
				for (const cell of tr.cells){
					const name = cell.getAttribute('name')
					if(name) body.append(name, cell.innerText.trim())
				}
			}
			else if (!form && elt.name) body.append(elt.name, elt.value)
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
	else if(target.indexOf('next ') == 0) {
		const matches = Array.from(document.querySelectorAll(target.substring(5)))
		e.detail.cfg.target = matches.find((el)=>e.target.compareDocumentPosition(el) === Node.DOCUMENT_POSITION_FOLLOWING)
	} else if(target.indexOf('previous ') == 0) {
		const matches = Array.from(document.querySelectorAll(target.substring(9))).reverse()
		e.detail.cfg.target = matches.find((el)=>e.target.compareDocumentPosition(el) === Node.DOCUMENT_POSITION_PRECEDING)
	} else if (target.indexOf('nav ') == 0) {
		for (const n of target.substring(4).split(' ')) {
			switch (n) {
				case 'parent': e.detail.cfg.target = e.detail.cfg.target.parentElement; break
				case 'next': e.detail.cfg.target = e.detail.cfg.target.nextElementSibling; break
				case 'previous': e.detail.cfg.target = e.detail.cfg.target.previousElementSibling; break
				case 'first': e.detail.cfg.target = e.detail.cfg.target.firstElementChild; break
				case 'last': e.detail.cfg.target = e.detail.cfg.target.lastElementChild; break
				default: console.warn(`$: Nav ${n} is not Valid`)
			}
		}
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
	$('#error').$.textContent = $('#success').$.textContent = ''
})

document.addEventListener('fx:after',e=>{//Set Error & Success
	if(e.detail.cfg.response.status < 300) setTimeout(_=>{$('#success').$.textContent = ''}, 2000)
	else if(e.detail.cfg.response.status < 400) {
		if (e.detail.cfg.text == 'refresh'){document.location.reload(); return}
		window.location.href = e.detail.cfg.text
	}
	else {e.detail.cfg.target = $('#error').$; e.detail.cfg.swap = 'innerHTML'}
})

document.addEventListener('fx:swapped',e=>{//Run Scripts then Create Icons
	e.detail.cfg.target.querySelectorAll('script').forEach(s=>
		s.replaceWith(Object.assign(document.createElement('script'),{textContent:s.textContent}))
	)
	if(lucide) lucide.createIcons()
})


// COMMON
function oassign(tag, obj) {return Object.assign(document.createElement(tag), obj)}

async function sleep(ms, e) {return await new Promise(resolve =>setTimeout(_=>{resolve(e)}, ms))}

function debounce (c, d) {
	let t
	return _=>{
		clearTimeout(t)
		t = setTimeout(c, d)
	}
}

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
	let count = 0
	let rows = Array.from(table.rows)
	const heads = rows.shift()
	const len = rows.length
	if (len > 20480 && !confirm(`WARNING! TABLE OVER 20K ROWS: ${len}\nJS FILTERING NOT RECOMMENDED. PROCEED?`)) return
	for (let e of heads.cells) {if (['►','▲','▼'].includes(e.textContent.substr(-1))) e.textContent=e.textContent.slice(0, -1) + '►'}
	rows.forEach(row =>{
		let found = false;
		for (const cell of row.cells) {
			if (cell.textContent.includes(term)) {found = true;break}
		}
		if (found) {row.style.display = ''; count++}
		else row.style.display = 'none'
	})
	return count
}

function sortTable(head) {
	const body = head.parentElement.parentElement
	const rows = [...body.rows].slice(1)
	const len = rows.length
	if (len > 20480 && !confirm(`WARNING! TABLE OVER 20K ROWS: ${len}\nJS SORTING NOT RECOMMENDED. PROCEED?`)) return
	const arrow = head.textContent.substr(-1)
	const heads = head.parentElement
	const column = [...heads.cells].indexOf(head)
	for (let e of heads.cells) {if (['►','▲','▼'].includes(e.textContent.substr(-1))) e.textContent=e.textContent.slice(0, -1) + '►'}
	const isDescending = arrow === '▼'
	head.textContent = head.textContent.slice(0, -1) + (isDescending ? '▲' : '▼')
	rows.sort((a, b) => {
		const comp = a.cells[column].textContent.localeCompare(b.cells[column].textContent, undefined, { numeric: true })
		return isDescending ? -comp : comp
	})
	body.replaceChildren(heads, ...rows)
	return true
}

function showType(show, head) {
	if (show) for (let i = 0; i < head.cells.length; i++) head.cells[i].innerHTML = head.cells[i].innerHTML.replace(/<span style="display: none;">\[(.*?)\]<\/span>/g, '[$1]')
	else for (let i = 0; i < head.cells.length; i++) head.cells[i].innerHTML = head.cells[i].innerHTML.replace(/\[(.*?)\]/g, '<span style="display: none;">[$1]</span>')
}

function generateKey(length=32) {
	const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
	let key = ''
	for (let i = 0; i < length; i++) key += chars[Math.floor(Math.random() * chars.length)]
	return key
}


// SETUP
let theme = localStorage.getItem('theme') || 'dark'
$('html').$.setAttribute('data-theme', theme)
let topButton, botButton

window.onload=_=>{
	topButton = $('#scrollerTop')?.$
	botButton = $('#scrollerBot')?.$
	lucide.createIcons()
}

window.addEventListener('scroll', _=>{
	if (topButton) {
		if (document.documentElement.scrollTop > 100) topButton.style.display = "block"
		else topButton.style.display = "none"
	}
	if (botButton) {
		if (document.documentElement.scrollHeight - window.innerHeight - document.documentElement.scrollTop > 100) botButton.style.display = "block"
		else botButton.style.display = "none"
	}
}, {passive: true})

document.addEventListener('mousedown',e=>{//fclick
	if(e.button || !e.target.closest('[fclick]')) return
	e.preventDefault(); e.target.click()
})
document.addEventListener('touchstart',e=>{
	if(!e.target.closest('[fclick]')) return
	e.preventDefault(); e.target.click()
})
