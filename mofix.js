//MOXI
(_=>{
	let doc = document
	if(doc.__moxi_mo) return
	let liveFns = new Set(), pending = false,
		recompute = evt=> {
		if (pending || ignore(evt?.target)) return
		pending = true
		queueMicrotask(_=>{liveFns.forEach(f=>f()); setTimeout(_=>pending = false)})
	}
	doc.__moxi_mo = new MutationObserver(recs=>{
		recs.forEach(r=>r.type == "childList" && r.addedNodes.forEach(n=>process(n)))
		recompute()
	})
	let AF = async function(){}.constructor, HARGS = ["q", "wait", "trigger", "debounce"],
	fire = (elt, type, detail, bub)=>elt.dispatchEvent(new CustomEvent(type, {detail, cancelable:1, bubbles:bub??1, composed:1})),
	el = (e,n,h,o)=>e.addEventListener(n,h,o),
	DB = Symbol(),
	mkDb =_=>{let last = 0, j; return ms=>new Promise((r,rj)=>{j?.(DB); j = rj; let id = ++last; setTimeout(_=>id == last && (j = null, r()), ms)})},
	mkWait = ctx=>x=>new Promise(r=>typeof x == "number" ? setTimeout(r,x) : el(ctx,x,r,{once:1})),
	ignore = elt => elt?.closest("[mx-ignore]"),
	one = x=>x?[x]:[],
	POS = {before:"beforebegin",after:"afterend",start:"afterbegin",end:"beforeend"},
	proxy = elts=>new Proxy({}, {
		get:(_,p)=>{
			if (p == "count") return elts.length
			if (p == "arr") return _=>elts.slice()
			if (p == Symbol.iterator) return _=>elts.values()
			if (p == "trigger") return (t,d,b)=>elts.forEach(e=>fire(e,t,d,b))
			if (p == "insert") return (pos,s)=>elts.forEach(e=>e.insertAdjacentHTML(POS[pos],s))
			if (p == "take") return (cls,from)=>{
				for (let e of typeof from == "string" ? doc.querySelectorAll(from) : from) e.classList.remove(cls)
				for (let e of elts) e.classList.add(cls)
			}
			let v = elts[0]?.[p]
			if (v?.call) return (...a)=>elts.map(e=>e[p](...a))[0]
			if (v && typeof v == "object") return proxy(elts.map(e=>e[p]))
			return v
		},
		set:(_,p,v)=>(elts.forEach(e=>e[p]=v),true)
	}),
	mkq = ctx=>sel=>{
		if (typeof sel != "string") return proxy(sel.nodeType ? [sel] : [...sel])
		let im = sel.match(/^(.+)\s+in\s+(.+)$/), root = doc
		if (im){ sel = im[1]; root = im[2] == "this" ? ctx : doc.querySelector(im[2]) }
		if (!root) return proxy([])
		let m = sel.match(/^(next|prev|closest|first|last)\s+(.+)$/), elts
		if (m){
			let [,d,s] = m, cdp = e=>ctx.compareDocumentPosition(e)
			if (d == "closest") elts = one(ctx.closest(s))
			else {
				let all = [...root.querySelectorAll(s)]
				if (d == "first") elts = all.slice(0,1)
				else if (d == "last") elts = all.slice(-1)
				else if (d == "next") elts = one(all.find(e=>cdp(e) & 4))
				else elts = one(all.reverse().find(e=>cdp(e) & 2))
			}
		} else elts = [...root.querySelectorAll(sel)]
		return proxy(elts)
	},
	init = elt=>{
		if (elt.__moxi || ignore(elt)) return
		if (!fire(elt, "mx:init", {})) return
		elt.__moxi = {}
		let q = mkq(elt), wait = mkWait(elt), trigger = fire.bind(0,elt), liveRuns = []
		for (let a of elt.attributes){
			if (a.name == "live"){
				let fn = new AF(...HARGS, a.value),
				debounce = mkDb(),
				run =_=>elt.isConnected ? fn.call(elt, q, wait, trigger, debounce) : liveFns.delete(run)
				liveFns.add(run)
				liveRuns.push(run)
			} else if (a.name.startsWith("on-")){
				let [name, ...mods] = a.name.slice(3).split("."),
				has = m=>mods.includes(m), h = has("halt"), debounce = mkDb()
				if (has("cc")) name = name.replace(/-([a-z])/g, (_,c)=>c.toUpperCase())
				let target = has("outside") ? doc : elt,
				opts = {capture: has("capture"), passive: has("passive"), once: has("once")},
				fn = new AF("event", ...HARGS, `with(event?.detail||{}){${a.value}}`),
				handler = elt.__moxi[name] = evt=>{
					if (evt && (has("self") && evt.target != elt || has("outside") && elt.contains(evt.target))) return
					if (h || has("prevent")) evt?.preventDefault()
					if (h || has("stop")) evt?.stopPropagation()
					return fn.call(elt, evt, q, wait, trigger, debounce).catch(e=>{if(e!=DB) throw e})
				}
				if (name == "init") handler()
				else el(target, name, handler, opts)
			}
		}
		liveRuns.forEach(r=>r())
		fire(elt, "mx:inited", {}, false)
	},
	process = n=>{
		if (n.nodeType != 1 || ignore(n)) return
		let r = doc.evaluate("descendant-or-self::*[@live or @*[starts-with(name(),'on-')]]", n, null, 7, null)
		for (let i = 0; i < r.snapshotLength; i++) init(r.snapshotItem(i))
	},
	gt = globalThis, de = doc.documentElement
	gt.q = mkq(de)
	gt.wait = mkWait(de)
	gt.transition = fn=>doc.startViewTransition ? doc.startViewTransition(fn) : fn()
	el(doc, "mx:process", evt=>process(evt.target))
	el(doc, "refresh", recompute)
	el(doc, "DOMContentLoaded", _=>{
		doc.__moxi_mo.observe(de, {childList:1, subtree:1, attributes:1, characterData:1})
		el(doc, "input", recompute, true)
		el(doc, "change", recompute, true)
		process(doc.body)
	})
})();

//FIXI
(_=>{
	if (document.__fixi_mo) return
	document.__fixi_mo = new MutationObserver((recs) => recs.forEach((r) => r.type === "childList" && r.addedNodes.forEach((n) => process(n))))
	let send = (elt, type, detail, bub) => elt.dispatchEvent(new CustomEvent("fx:" + type, { detail, cancelable: true, bubbles: bub !== false, composed: true }))
	let attr = (elt, name, defaultVal) => elt.getAttribute(name) || defaultVal
	let ignore = (elt) => elt.closest("[fx-ignore]") != null
	let init = (elt) => {
		let options = {}
		if (elt.__fixi || ignore(elt) || !send(elt, "init", { options })) return
		elt.__fixi = async (evt) => {
			let reqs = elt.__fixi.requests ||= new Set()
			let body = new FormData()
			if (elt instanceof HTMLFormElement) body = new FormData(elt, evt.submitter)
			else if (elt instanceof HTMLTableRowElement) {
				for (const cell of elt.cells) {
					const name = cell.getAttribute("name")
					if (name) body.append(name, cell.innerText.trim())
				}
			}
			else if (elt.name) body.append(elt.name, elt.value)
			if (!elt.matches('input[type="file"], input[type="image"]')) body = new URLSearchParams(body)
			let ac = new AbortController()
			let cfg = {
				trigger: evt,
				action: attr(elt, "fx-action", ""),
				method: attr(elt, "fx-method", "GET").toUpperCase(),
				target: document.querySelector(attr(elt, "fx-target")) ?? elt,
				swap: attr(elt, "fx-swap", "innerHTML"),
				body,
				drop: reqs.size,
				abort: ac.abort.bind(ac),
				signal: ac.signal,
				preventTrigger: true,
				transition: document.startViewTransition?.bind(document),
				fetch: fetch.bind(window)
			}
			let go = send(elt, "config", { cfg, requests: reqs })
			if (cfg.preventTrigger) evt.preventDefault()
			if (!go || cfg.drop) return
			if (/GET|DELETE/.test(cfg.method)) {
				if (cfg.body.size) cfg.action += (/\?/.test(cfg.action) ? "&" : "?") + cfg.body
				cfg.body = null
			}
			reqs.add(cfg)
			try {
				if (cfg.confirm) {
					let result = await cfg.confirm()
					if (!result) return
				}
				if (!send(elt, "before", { cfg, requests: reqs })) return
				if (cfg.method == "LOCAL") {
					const fn = eval(cfg.action)
					cfg.text = await fn(Object.fromEntries(cfg.body))
					cfg.response = { "status": 200 }
					if (cfg.text.startsWith('ERROR:')) cfg.response.status = 555
				}
				else {
					cfg.response = await cfg.fetch(cfg.action, cfg)
					cfg.text = await cfg.response.text()
				}
				if (!send(elt, "after", { cfg })) return
			} catch (error) {
				send(elt, "error", { cfg, error })
				return
			} finally {
				reqs.delete(cfg)
				send(elt, "finally", { cfg })
			}
			let doSwap =_=>{
				if (cfg.swap instanceof Function) return cfg.swap(cfg)
				else if (/(before|after)(begin|end)/.test(cfg.swap)) cfg.target.insertAdjacentHTML(cfg.swap, cfg.text)
				else if (cfg.swap in cfg.target) cfg.target[cfg.swap] = cfg.text
				else if (cfg.swap !== "none") throw cfg.swap
			}
			if (cfg.transition) await cfg.transition(doSwap).finished
			else await doSwap()
			send(elt, "swapped", { cfg })
			if (!document.contains(elt)) send(document, "swapped", {cfg})
		}
		elt.__fixi.evt = attr(elt, "fx-trigger", elt.matches("form") ? "submit" : elt.matches("input:not([type=button]),select,textarea") ? "change" : "click").split("|")
		elt.__fixi.evt.forEach(a=>{elt.addEventListener(a, elt.__fixi, options)})
		send(elt, "inited", {}, false)
	}
	let process =(n)=>{
		if (n.matches) {
			if (ignore(n)) return
			if (n.matches("[fx-method]")) init(n)
		}
		if (n.querySelectorAll) {
			n.querySelectorAll("[fx-method]").forEach(init)
			n.querySelectorAll("[fx-trigger]:not([fx-method])").forEach(e=>{
				const p = e.closest("[fx-method]")
				if (p) {
					e.getAttribute("fx-trigger").split("|").forEach(t=>{
						e.addEventListener(t, _=>{p.dispatchEvent(new Event(p.__fixi.evt, {cancelable: true, bubbles: true, composed: true}))})
					})
				}
			})
		}
	}
	document.addEventListener("fx:process", evt=>process(evt.target))
	document.addEventListener("DOMContentLoaded", _=>{
		document.__fixi_mo.observe(document.documentElement, { childList: true, subtree: true })
		process(document.body)
	})
})();

//FIXI ADDONS
document.addEventListener('fx:init', e=>{//Disable During Request
	const el = e.target
	if(!el.matches('[fx-disable]')) return
	const disableSelector = el.getAttribute('fx-disable')
	el.addEventListener('fx:before',_=>{
		let disableTarget = disableSelector == "" ? el : document.querySelector(disableSelector)
		disableTarget.disabled = true
		el.addEventListener('fx:after', (afterEvt)=>{if(afterEvt.target == el) disableTarget.disabled = false})
	})
})

document.addEventListener("fx:config", evt=> {//Relative Selectors
	const t = evt.target
	let cmd = t.getAttribute("fx-target")
	if (!cmd) return
	let ctx = document
	const im = cmd.match(/^(.+)\s+in\s+(.+)$/)
	if (im) {cmd = im[1]; ctx = im[2] == "this" ? t : document.querySelector(im[2])}
	if (!ctx) return
	const m = cmd.match(/^(next|prev|closest|first|last)\s+(.+)$/)
	evt.detail.cfg.target = m ? {
		closest: s => t.closest(s),
		first: s => ctx.querySelector(s),
		last: s => [...ctx.querySelectorAll(s)].pop(),
		next: s => [...document.querySelectorAll(s)].find(e=>t.compareDocumentPosition(e) & 4),
		prev: s => [...document.querySelectorAll(s)].reverse().find(e=>t.compareDocumentPosition(e) & 2),
	}[m[1]](m[2]) : ctx.querySelector(cmd)
})

document.addEventListener('fx:config', e=>{//Vals
	const valsAttr = e.target.getAttribute('fx-vals')
	if (!valsAttr) return
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

document.addEventListener('fx:after',e=>{//Select
	const select = e.target.getAttribute('fx-select')
	if (!select) return
	const t = Object.assign(document.createElement('template'),{innerHTML:e.detail.cfg.text})
	e.detail.cfg.text = t.content.querySelector(select).outerHTML
})

document.addEventListener('fx:after', e=>{//Set Error & Success
	if (e.detail.cfg.response.status < 300) {
		msg.classList.remove('alert-error');
		msg.classList.add('alert-success');
		wait(3000);
		msg.firstElementChild.textContent = ''
	}
	else if(e.detail.cfg.response.status < 400) {
		if (e.detail.cfg.text == 'refresh') {document.location.reload();return}
		window.location.href = e.detail.cfg.text
	}
	else {
		msg.classList.remove('alert-success');
		msg.classList.add('alert-error');
		e.detail.cfg.target = error;
		e.detail.cfg.swap = 'innerHTML'
	}
})

document.addEventListener('fx:swapped', _=>{//Run Scripts then Create Icons
	if (typeof lucide !== 'undefined') lucide.createIcons()
})


//miniJQ
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
			return matches.find((el)=>els[0].compareDocumentPosition(el) === Node.DOCUMENT_POSITION_FOLLOWING)
		},
		previous: (n)=>{
			const matches = Array.from(document.querySelectorAll(n)).reverse()
			return matches.find((el)=>els[0].compareDocumentPosition(el) === Node.DOCUMENT_POSITION_PRECEDING)
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
		onchil: (e, c)=>(Array.from(els[0].children).forEach(el => el.addEventListener(e, c)),this),
		off: (e, c)=>(els.forEach(el => el.removeEventListener(e, c)), this),
		run: (c)=>(els.forEach(el => c(el)), this),
		send: (name, detail, bubbles = true, cancelable = true)=>(els.forEach(el => el.dispatchEvent(new CustomEvent(name, { detail, bubbles, cancelable }))), this),
		// Add more chainables here
	}
}


//COMMON
function oassign(tag, obj) {return Object.assign(document.createElement(tag), obj)}

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

function copyToClipboard(text) {
	if (navigator.clipboard && navigator.clipboard.writeText) {navigator.clipboard.writeText(text);return}
	const textarea = oassign('textarea')
	textarea.value = text
	document.body.appendChild(textarea)
	textarea.select()
	document.execCommand('copy')
	document.body.removeChild(textarea)
}

//TABLE Helpers
function exportTable(table, sep='|', filename) {
	const rows = [...table.rows]
	const data = rows.filter(row => row.style.display !== 'none').map((row, index)=>[...row.cells].map(cell=>index=== 0?cell.innerText.slice(0, -2):cell.textContent))
	saveCSV(data.map(row => row.join(sep)).join('\n'), filename)
}

function saveCSV(text, filename='export.csv') {
	const a = oassign('a')
	a.href = URL.createObjectURL(new Blob([text], {type: 'text/csv'}))
	a.download = filename
	a.click()
	URL.revokeObjectURL(a.href)
}

function searchTable(table, term) {
	let count = 0
	let rows = [...table.rows].slice(1)
	const len = rows.length
	if (len > 10240 && !confirm(`WARNING! TABLE OVER 10K ROWS: ${len}\nJS FILTERING NOT RECOMMENDED. PROCEED?`)) return
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
	const arrow = head.textContent.substr(-1)
	if (!['►','▲','▼'].includes(arrow)) return
	const body = head.parentElement.parentElement
	const rows = [...body.rows].slice(1)
	const len = rows.length
	if (len > 10240 && !confirm(`WARNING! TABLE OVER 10K ROWS: ${len}\nJS SORTING NOT RECOMMENDED. PROCEED?`)) return
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
}

function showType(show, head) {
	if (show) for (let i = 0; i < head.cells.length; i++) head.cells[i].innerHTML = head.cells[i].innerHTML.replace(/<span style="display: none;">\[(.*?)\]<\/span>/g, '[$1]')
	else for (let i = 0; i < head.cells.length; i++) head.cells[i].innerHTML = head.cells[i].innerHTML.replace(/\[(.*?)\]/g, '<span style="display: none;">[$1]</span>')
}


//GOLANG Helpers
const NANO_MULTIPLIERS = {
	ns: 1,
	us: 1000,
	ms: 1000 * 1000,
	s: 1000 * 1000 * 1000,
	m: 60 * 1000 * 1000 * 1000,
	h: 60 * 60 * 1000 * 1000 * 1000,
}

function durationToNanos(durationString) {// This is golang specific. eg. 72h30m1s100ms10us5ns
	if (!durationString) return 0
	let totalNanoseconds = 0
	let lastIndex = 0
	const matches = [...durationString.matchAll(/(\d+)(ns|us|ms|s|m|h)/g)]
	if (matches.length === 0 && durationString.length > 0) throw new Error(`Invalid duration string format: "${durationString}"`)
	for (const match of matches) {
		totalNanoseconds += parseInt(match[1], 10) * NANO_MULTIPLIERS[match[2]]
		lastIndex = match.index + match[0].length
	}
	if (lastIndex !== durationString.length) throw new Error(`Invalid characters found in duration string: "${durationString}"`)
	return totalNanoseconds
}
