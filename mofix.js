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
	ael = (e,n,h,o)=>e.addEventListener(n,h,o),
	DB = Symbol(),
	mkDb =_=>{let last = 0, j; return ms=>new Promise((r,rj)=>{j?.(DB); j = rj; let id = ++last; setTimeout(_=>id == last && (j = null, r()), ms)})},
	mkWait = ctx=>x=>new Promise(r=>typeof x == "number" ? setTimeout(r,x) : ael(ctx,x,r,{once:1})),
	ignore =elt=>elt?.closest("[mx-ignore]"),
	POS = {before:"beforebegin",after:"afterend",start:"afterbegin",end:"beforeend"},
	proxy = elts=>new Proxy({},{
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
	mkqf={
		closest:(s,c,t)=>(c||t).closest(s),
		first:(s,c,_)=>(c||doc).querySelector(s),
		last:(s,c,_)=>[...(c||doc).querySelectorAll(s)].at(-1),
		next:(s,c,t,r=c||t)=>s.slice(0,3) == "sib" ? r.nextElementSibling : [...doc.querySelectorAll(s)].find(el =>r.compareDocumentPosition(el) & 4),
		prev:(s,c,t,r=c||t)=>s.slice(0,3) == "sib" ? r.previousElementSibling : [...doc.querySelectorAll(s)].findLast(el =>r.compareDocumentPosition(el) & 2),
		split:cmd=>cmd.split(/\s*->\s*/).filter(Boolean),
		run:(cmd,c,t)=>{
			const [,fn,s] = cmd.match(/^(closest|first|last|next|prev)\s+(.+)$/)||[]
			return [fn,fn ? mkqf[fn](s,c,t) : (c||doc).querySelector(cmd)]
		}
	},
	mkq = ctx=>sel=>{
		if (typeof sel != "string") return proxy(sel.nodeType ? [sel] : [...sel])
		const cmds = mkqf.split(sel)
		let i = 0
		for (const cmd of cmds) {
			const [fn, res] = mkqf.run(cmd, ++i > 1 ? ctx : undefined, ctx)
			if (i == cmds.length) return proxy(fn ? (res ? [res] : []) : [...(i > 1 ? ctx : doc).querySelectorAll(cmd)])
			if (!(ctx = res)) break
		}
		return proxy([])
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
				else ael(target, name, handler, opts)
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
	gt.qf = mkqf
	gt.q = mkq(de)
	gt.wait = mkWait(de)
	gt.transition = fn=>doc.startViewTransition ? doc.startViewTransition(fn) : fn()
	ael(doc, "mx:process", evt=>process(evt.target))
	ael(doc, "refresh", recompute)
	ael(doc, "DOMContentLoaded", _=>{
		doc.__moxi_mo.observe(de, {childList:1, subtree:1, attributes:1, characterData:1})
		ael(doc, "input", recompute, true)
		ael(doc, "change", recompute, true)
		process(doc.body)
	})
})();

//FIXI
(_ => {
	let doc = document
	if (doc.__fixi_mo) return
	doc.__fixi_mo = new MutationObserver((recs) => recs.forEach((r) => r.type === "childList" && r.addedNodes.forEach((n) => process(n))))
	let ael = (e,n,h,o)=>e.addEventListener(n,h,o)
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
					const name = attr(cell, "name")
					if (name) body.append(name, cell.innerText.trim())
				}
			}
			else if (elt.name) body.append(elt.name, elt.value)
			if (!elt.matches('input[type="file"],input[type="image"]')) body = new URLSearchParams(body)
			let ac = new AbortController()
			let cfg = {
				trigger: evt,
				action: attr(elt, "fx-action", ""),
				method: attr(elt, "fx-method", "GET").toUpperCase(),
				target: doc.querySelector(attr(elt, "fx-target")) ?? elt,
				swap: attr(elt, "fx-swap", "innerHTML"),
				body,
				drop: reqs.size,
				abort: ac.abort.bind(ac),
				signal: ac.signal,
				preventTrigger: true,
				transition: doc.startViewTransition?.bind(doc),
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
				send(elt, "error", { cfg, error }); return
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
			if (!doc.contains(elt)) send(doc, "swapped", {cfg})
		}
		elt.__fixi.evt = attr(elt, "fx-trigger", elt.matches("form") ? "submit" : elt.matches("input:not([type=button]),select,textarea") ? "change" : "click").split("|")
		elt.__fixi.evt.forEach(a=>{ael(elt, a, elt.__fixi, options)})
		send(elt, "inited", {}, false)
	}
	let process =n=>{
		if (n.matches) {
			if (ignore(n)) return
			if (n.matches("[fx-method]")) init(n)
		}
		if (n.querySelectorAll) {
			n.querySelectorAll("[fx-method]").forEach(init)
			n.querySelectorAll("[fx-trigger]:not([fx-method])").forEach(e=>{
				const p = e.closest("[fx-method]")
				if (p) {
					attr(e, "fx-trigger").split("|").forEach(t=>{
						ael(e, t, _=>{p.dispatchEvent(new Event(p.__fixi.evt, {cancelable: true, bubbles: true, composed: true}))})
					})
				}
			})
		}
	}
	ael(doc, "fx:process", evt=>process(evt.target))
	ael(doc, "DOMContentLoaded", _=>{
		doc.__fixi_mo.observe(doc.documentElement, { childList: true, subtree: true })
		process(doc.body)
	})
})();

(_=>{
	let mx = (o, n, ids)=>{
		if (o.nodeType !== n.nodeType || o.nodeName !== n.nodeName){
			n.querySelectorAll?.("[id]").forEach((ne)=>{
				if (!n.contains(ne)) return
				let oe = ids[ne.id]
				if (oe){ delete ids[ne.id]; mx(oe, ne, ids); ne.replaceWith(oe) }
			})
			return o.replaceWith(n)
		}
		if (o.nodeType === 3 || o.nodeType === 8){
			if (o.nodeValue !== n.nodeValue) o.nodeValue = n.nodeValue
			return
		}
		for (let a of [...o.attributes]) if (!n.hasAttribute(a.name)) o.removeAttribute(a.name)
		for (let a of n.attributes) if (o.getAttribute(a.name) !== a.value) o.setAttribute(a.name, a.value)
		let oIds = {}
		for (let c of o.children) if (c.id) oIds[c.id] = c
		let oc = o.firstChild, nc = n.firstChild, on, nn, m
		while (oc && nc){
			on = oc.nextSibling; nn = nc.nextSibling
			if (nc.id){
				m = oIds[nc.id]
				if (m && m !== oc){ o.insertBefore(m, oc); mx(m, nc, ids); nc = nn; continue }
				if (!m){ o.insertBefore(nc, oc); nc = nn; continue }
			}
			mx(oc, nc, ids)
			oc = on; nc = nn
		}
		while (oc){ on = oc.nextSibling; oc.remove(); oc = on }
		while (nc){ nn = nc.nextSibling; o.appendChild(nc); nc = nn }
	}
	window.morph = (target, html)=>{
		let t = document.createElement("template")
		t.innerHTML = html
		let ids = {}
		target.querySelectorAll("[id]").forEach(e=>ids[e.id] = e)
		mx(target, t.content.firstElementChild, ids)
	}
	document.addEventListener("fx:config", e=>{
		if (e.detail.cfg.swap === "morph") e.detail.cfg.swap = cfg=>morph(cfg.target, cfg.text)
	})
})();

//FIXI ADDONS
document.addEventListener('fx:init',e=>{//Debounce
	let t = e.target
	if (!t.hasAttribute('fx-debounce')) return
	t.addEventListener('fx:inited', _=>{
		t.removeEventListener(t.__fixi.evt, t.__fixi)
		let debounceTime = parseInt(t.getAttribute('fx-debounce'))
		let timeout = null
		t.addEventListener(t.__fixi.evt,e=>{
			clearTimeout(timeout)
			timeout = setTimeout(_=>t.__fixi(e), debounceTime)
		})
	})
})

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

document.addEventListener("fx:init",e=>{//Polling
	let elt = e.target
	if (elt.matches("[ext-fx-poll-interval]")){
		elt.addEventListener("fx:inited",_=>{
			elt.__fixi.pollInterval = setInterval(_ => { elt.dispatchEvent(new CustomEvent("poll")) }, parseInt(elt.getAttribute("fx-poll")))
		})
	}
})

document.addEventListener('fx:config',e=>{//Confirm Dialog
	const confirmationMessage = e.getAttribute('fx-confirm')
	if(confirmationMessage) e.detail.cfg.confirm =_=>confirm(confirmationMessage)
})

document.addEventListener("fx:config",e=> {//Moxi Relative Selectors
	let c, t = e.target
	for (const cmd of qf.split(t.getAttribute("fx-target") || "")) {
		if (!(e.detail.cfg.target = c = qf.run(cmd, c, t)[1])) break
	}
})

document.addEventListener('fx:config', e=>{//Vals
	const valsAttr = e.target.getAttribute('fx-vals')
	if (!valsAttr) return
	let vals
	if(valsAttr.startsWith('js:')) vals = new Function('return ' + valsAttr.slice(3))()
	else vals = new Function('return ' + valsAttr)()
	if(typeof vals !== 'object' || vals == null || Array.isArray(vals)){
		console.error('fx-vals not a valid object:', vals);return
	}
	for (let key in vals){
		if(typeof key === 'string' && key.trim() == '') continue
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
		toast.classList.remove('alert-error')
		toast.classList.add('alert-success')
		wait(3000)
		msg.textContent = ''
	}
	else if(e.detail.cfg.response.status < 400) {
		if (e.detail.cfg.text == 'refresh') {document.location.reload();return}
		window.location.href = e.detail.cfg.text
	}
	else {
		toast.classList.remove('alert-success')
		toast.classList.add('alert-error')
		e.detail.cfg.target = msg;
		e.detail.cfg.swap = 'innerHTML'
	}
})

document.addEventListener('fx:swapped', _=>{//Create Icons
	lucide.createIcons()
})

//COMMON
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

//TABLE Helpers
function exportTable(table, sep='|', filename) {
	const rows = [...table.rows]
	const data = rows.filter(row => row.style.display != 'none').map((row, index)=>[...row.cells].map(cell=>index== 0?cell.innerText.slice(0, -2):cell.textContent))
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
	const isDescending = arrow == '▼'
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

function generateKey() { // Create 32 character Device ID.
	const bytes = crypto.getRandomValues(new Uint8Array(24))
	const binary = String.fromCharCode(...bytes)
	return btoa(binary).replace(/[+/]/g, char => char === '+' ? '-' : '_')
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
	if (matches.length == 0 && durationString.length > 0) throw new Error(`Invalid duration string format: "${durationString}"`)
	for (const match of matches) {
		totalNanoseconds += parseInt(match[1], 10) * NANO_MULTIPLIERS[match[2]]
		lastIndex = match.index + match[0].length
	}
	if (lastIndex != durationString.length) throw new Error(`Invalid characters found in duration string: "${durationString}"`)
	return totalNanoseconds
}
