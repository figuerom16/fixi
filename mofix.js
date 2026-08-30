const doc = document
EventTarget.prototype.ael = EventTarget.prototype.addEventListener

const qops={//Query ops
	closest:(s,c)=>s.startsWith("par")?c.parentElement:c.closest(s),
	first:(s,c)=>s.startsWith("chi")?c.firstElementChild:c.querySelector(s),
	last:(s,c)=>s.startsWith("chi")?c.lastElementChild:[...c.querySelectorAll(s)].at(-1),
	next:(s,c)=>s.startsWith("sib")?c.nextElementSibling:[...doc.querySelectorAll(s)].find(el=>c.compareDocumentPosition(el)&4),
	prev:(s,c)=>s.startsWith("sib")?c.previousElementSibling:[...doc.querySelectorAll(s)].findLast(el=>c.compareDocumentPosition(el)&2),
	re:/^(closest|first|last|next|prev)\s+(.+)$/
}
function q(s,c) {//Query one
	c = c || doc.currentScript || (this instanceof Element && this) || globalThis.event?.target || null
	if (!s||!c) return c
	const cmds = s.split("->")
	if (cmds[0].trim()=="doc") {c=doc; cmds.shift()}
	for (let i = 0; i < cmds.length; i++) {
		const cm = cmds[i].trim()
		if (!cm) continue
		const m = cm.match(qops.re)
		if (i==cmds.length-1) return m ? qops[m[1]](m[2], c) ?? null : c.querySelector(cm)
		c = m ? qops[m[1]](m[2],c):c.querySelector(cm)
		if (!c) return null
	}
	return c
}
function qa(s,c) {//Query all
	c = c || doc.currentScript || (this instanceof Element && this) || globalThis.event?.target || null
	if (!s||!c) return []
	const p=s.lastIndexOf("->")
	if (p<0) return [...c.querySelectorAll(s)]
	const head=q(s.slice(0,p),c)
	if (!head) return []
	const tail=s.slice(p+2).trim()
	const m=tail.match(qops.re)
	if (!m) return [...head.querySelectorAll(tail)]
	const el=qops[m[1]](m[2],head)
	return el?[el]:[]
}

(_=>{//MOXI
	if(doc.__moxi_mo) return
	let liveFns = new Set(), pending = false,
	recompute = evt=>{
		if (pending || ignore(evt?.target)) return
		pending = true
		queueMicrotask(_=>{liveFns.forEach(f=>f()); setTimeout(_=>pending = false)})
	}
	doc.__moxi_mo = new MutationObserver(recs=>{
		recs.forEach(r=>r.type == "childList" && r.addedNodes.forEach(n=>process(n)))
		recompute()
	})
	let AF = async function(){}.constructor, HARGS = ["q", "qa", "wait", "trigger", "debounce"],
	fire = (elt,type,detail,bub)=>elt.dispatchEvent(new CustomEvent(type,{detail,cancelable:1,bubbles:bub??1,composed:1})),
	DB = Symbol(),
	mkDb =_=>{let last = 0, j; return ms=>new Promise((r,rj)=>{j?.(DB); j = rj; let id = ++last; setTimeout(_=>id == last && (j = null, r()), ms)})},
	mkWait = ctx=>x=>new Promise(r=>typeof x == "number" ? setTimeout(r,x) : ctx.ael(x,r,{once:1})),
	ignore = elt=>elt?.closest("[mx-ignore]"),
	init = elt=>{
		if (elt.__moxi || ignore(elt)) return
		if (!fire(elt, "mx:init", {})) return
		elt.__moxi = {}
		let qs=s=>q(s,elt), qsa=s=>qa(s,elt), wait = mkWait(elt), trigger = fire.bind(0,elt), liveRuns = []
		for (let a of elt.attributes){
			if (a.name == "live"){
				let fn = new AF(...HARGS, a.value),
				debounce = mkDb(),
				run =_=>elt.isConnected ? fn.call(elt, qs, qsa, wait, trigger, debounce) : liveFns.delete(run)
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
					return fn.call(elt, evt, qs, qsa, wait, trigger, debounce).catch(e=>{if(e!=DB) throw e})
				}
				if (name == "init") handler()
				else target.ael(name, handler, opts)
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
	gt.wait = mkWait(de)
	gt.transition = fn=>doc.startViewTransition ? doc.startViewTransition(fn) : fn()
	doc.ael("mx:process", evt=>process(evt.target))
	doc.ael("refresh", recompute)
	doc.ael("DOMContentLoaded", _=>{
		doc.__moxi_mo.observe(de, {childList:1, subtree:1, attributes:1, characterData:1})
		doc.ael("input", recompute, true)
		doc.ael("change", recompute, true)
		process(doc.body)
	})
})();

(_=>{//FIXI
	if (doc.__fixi_mo) return
	doc.__fixi_mo = new MutationObserver((recs) => recs.forEach((r) => r.type === "childList" && r.addedNodes.forEach((n) => process(n))))
	let send = (elt, type, detail, bub) => elt.dispatchEvent(new CustomEvent("fx:" + type, { detail, cancelable: 1, bubbles: bub??1, composed: 1 }))
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
					if (name) body.append(name, attr(cell, "value", "").trim())
				}
			}
			else if (elt.name) {
				for (const value of elt.files || [elt.value]) body.append(elt.name, value)
			}
			if (!elt.matches('input[type="file"],input[type="image"]')) body = new URLSearchParams(body)
			let ac = new AbortController()
			let cfg = {
				trigger: evt,
				action: attr(elt, "fx-action", ""),
				method: attr(elt, "fx-method", "GET").toUpperCase(),
				target: q(attr(elt, "fx-target"),elt),
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
		elt.__fixi.evt.forEach(a=>{elt.ael(a,elt.__fixi, options)})
		send(elt, "inited", {}, false)
	}
	let process =n=>{
		if (n.matches) {
			if (ignore(n)) return
			if (n.matches("[fx-method]")) init(n)
		}
		if(n.querySelectorAll) qa("[fx-method]",n).forEach(init)
	}
	doc.ael("fx:process", evt=>process(evt.target))
	doc.ael("DOMContentLoaded", _=>{
		doc.__fixi_mo.observe(doc.documentElement, { childList: 1, subtree: 1 })
		process(doc.body)
	})
	//FIXI ADDONS
	doc.ael("fx:before",e=>{//Clear Toast
		msg.textContent = ''
		toast.classList.remove('alert-error')
		toast.classList.remove('alert-success')
		const target = e.detail.cfg.trigger.target
		const eform = target.tagName == 'FORM' ? target : target.parentElement
		qa("[aria-invalid=true]",eform).forEach(el=>{el.removeAttribute('aria-invalid');el.nextElementSibling.textContent=''})
	})
	doc.ael('fx:after',e=>{//Set Error/Success & Redirect/Refresh
		if (e.detail.cfg.response.status < 300) toast.classList.add('alert-success')
		else if (e.detail.cfg.response.status < 400) {
			if (e.detail.cfg.text == 'refresh') {doc.location.reload();return}
			window.location.href = e.detail.cfg.text
		}
		else {
			toast.classList.add('alert-error')
			e.detail.cfg.target = msg;
			e.detail.cfg.swap = 'innerHTML'
			if (e.detail.cfg.response.status == 422) {
				const errs = e.detail.cfg.text.split('<br>')
				const target = e.detail.cfg.trigger.target
				const eform = target.tagName == 'FORM' ? target : target.parentElement
				e.detail.cfg.text = errs[0]
				for (let i = 1; i < errs.length; i++) {
					const [name, errmsg] = errs[i].split(':')
					const small = q(`[name=${name}]`,eform)?.nextElementSibling
					if (!small) { e.detail.cfg.text += '<br>' + errs[i]; continue}
					small.textContent = errmsg
					small.previousElementSibling.setAttribute('aria-invalid','true')
				}
				q("[aria-invalid=true]",eform)?.focus()
			}
		}
	})
	doc.ael('fx:swapped',_=>{lucide.createIcons()})//Create Icons
})();

(_=>{//PAXI
	let mx = (o, n, ids)=>{
		if (o.nodeType !== n.nodeType || o.nodeName !== n.nodeName){
			qa("[id]",n).forEach((ne)=>{
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
		let t = doc.createElement("template")
		t.innerHTML = html
		let ids = {}
		qa("[id]",target).forEach(e=>ids[e.id]=e)
		mx(target, t.content.firstElementChild, ids)
	}
	doc.ael("fx:config", e=>{
		if (e.detail.cfg.swap === "morph") e.detail.cfg.swap = cfg=>morph(cfg.target, cfg.text)
	})
})();

const OmegaTable = {//OmegaTable
	getArrows() {return{neut:'▶',desc:'▼',asc:'▲'}},
	getHeaders(table) {//Returns object with headers.
		const {neut,desc,asc} = this.getArrows()
		return [...table.tHead.rows[0].cells].map(cell => cell.textContent.replace(new RegExp(`[${neut}${desc}${asc}]$`),'').trim())
	},
	tr(tr) {//Row setup to put td values back into controls
		if (!(tr instanceof HTMLTableRowElement)) {console.error("OmegaTable.tr: Must be attached to Table Row Element!");return}
		qa('td[value]',tr).forEach(td=>{
			const value = td.getAttribute('value')
			if (!value) return
			const values = value.split('|')
			const fset = qa('fieldset->input[type="radio"],input[type="checkbox"]', td)
			if (fset.length != 0){fset.forEach(input=>{input.checked = values.includes(input.value)});return}
			const ctrl = q('input,select,textarea', td)
			if (!ctrl) td.textContent = value
			else if (ctrl.type == 'checkbox') ctrl.checked = value == 'true'
			else if (ctrl.multiple) Array.from(ctrl.options).forEach(option=>option.selected = values.includes(option.value))
			else ctrl.value = value
		})
	},
	tbody(tbody) {//tbody Handler
		if (tbody.tagName != 'TBODY') {console.error("OmegaTable.tbody: Must be attached to Table Tbody!");return}
		const ctrlVal=ctrl=>{//Control Value Helper Functions
			const fset = ctrl.closest('fieldset')
			if (fset && ctrl.type == 'radio') return ctrl.value.replace(/\|/g,'')
			if (fset && ctrl.type == 'checkbox') return qa('input[type="checkbox"]',fset).filter(input=>input.checked).map(input=>input.value.replace(/\|/g,'')).join('|')
			if (ctrl.type == 'checkbox') return ctrl.checked
			if (ctrl.multiple) return [...ctrl.selectedOptions].map(option=>option.value.replace(/\|/g,'')).join('|')
			return ctrl.value
		}
		tbody.ael('input',e=>{//Input updates value on td
			const td = e.target.closest('td[value]')
			if (!td) return
			const ctrl = e.target.closest('input,select,textarea') || td
			td.setAttribute('value', ctrl === td ? td.textContent : ctrlVal(ctrl))
		})
		tbody.ael('click',e=>{//Click Focus
			const td = e.target.closest('td')
			if (!td || !tbody.contains(td) || e.target.closest('fieldset,input,select,textarea')) return
			td.tabIndex = -1
			td.focus()
			const selection = window.getSelection()
			const range = doc.createRange()
			range.selectNodeContents(td)
			selection.removeAllRanges()
			selection.addRange(range)
		})
		tbody.ael('keydown',e=>{//Space click, CTRL + arrow Nav, CTRL + c
			if (e.key == ' ' && e.target.matches('td')) {
				const button = q('button',e.target)
				if (button) {button.click(); e.preventDefault(); return}
			}
			if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() == 'c') {
				const td = e.target.closest('td')
				if (td) {
					const value = td.hasAttribute('value') ? td.getAttribute('value') : td.textContent
					navigator.clipboard.writeText(String(value))
					e.preventDefault()
				}
				return
			}
			if (!(e.ctrlKey || e.metaKey) || !['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) return
			const td = e.target.closest('tbody td')
			if (!td || !tbody.contains(td)) return
			const rows = [...tbody.rows].filter(row=>row.style.display != 'none')
			const row = td.parentElement, rowIndex = rows.indexOf(row)
			if (rowIndex < 0) return
			let nextRowIndex = rowIndex, nextCellIndex = td.cellIndex
			if (e.key == 'ArrowUp') nextRowIndex--
			if (e.key == 'ArrowDown') nextRowIndex++
			if (e.key == 'ArrowLeft') nextCellIndex--
			if (e.key == 'ArrowRight') nextCellIndex++
			const next = rows[nextRowIndex]?.cells[nextCellIndex]
			if (!next) {e.preventDefault();return}
			const ctrl = q('input,select,textarea',next)
			if (ctrl) {
				window.getSelection()?.removeAllRanges()
				ctrl.tabIndex = -1
				ctrl.focus()
				if (typeof ctrl.select == 'function') ctrl.select()
			} else {
				next.tabIndex = -1
				next.focus()
				const selection = window.getSelection()
				const range = doc.createRange()
				range.selectNodeContents(next)
				selection.removeAllRanges()
				selection.addRange(range)
			}
			e.preventDefault()
		})
	},
	thead(thead) {//Column Sorter
		if (thead.tagName != 'THEAD') {console.error("OmegaTable.thead: Must be attached to Table Head Element!");return}
		const table = thead.closest('table')
		const tbody = table.tBodies[0]
		const {neut,desc,asc} = this.getArrows()
		const headers = this.getHeaders(table)
		const arrows = new Set([neut, desc, asc])
		qa('th',thead).forEach(th=>{
			if (!arrows.has(th.textContent.at(-1))) return
			th.classList.add('clickable')
			th.ael('click',_=>{
				const arrow = th.textContent.substr(-1)
				const heads = thead.rows[0].cells
				const rows = [...tbody.rows]
				const len = rows.length
				if (len > 10240 && !confirm(`WARNING! TABLE OVER 10K ROWS: ${len}\nJS SORTING NOT RECOMMENDED. PROCEED?`)) return
				for (let e of heads) {if (arrows.has(e.textContent.at(-1))) e.textContent = headers[e.cellIndex] + ' ' + neut}
				const isDescending = arrow == desc
				th.textContent = headers[th.cellIndex] + ' ' + (isDescending ? asc : desc)
				rows.sort((a, b) => {
					const aValue = a.cells[th.cellIndex]?.getAttribute('value') ?? a.cells[th.cellIndex]?.textContent ?? ''
					const bValue = b.cells[th.cellIndex]?.getAttribute('value') ?? b.cells[th.cellIndex]?.textContent ?? ''
					const comp = aValue.localeCompare(bValue, undefined, { numeric: true })
					return isDescending ? -comp : comp
				})
				tbody.append(...rows)
			})
		})
	},
	search(table,column = '',term = '') {//Search Table which sets unmatched rows to hide. Returns result count.
		const tbody = table.tBodies[0]
		let rows = [...tbody.rows]
		if (!term) {rows.forEach(row=>row.style.display = ''); return 0}
		let columnIndex = column ? this.getHeaders(table).indexOf(column) : null
		const len = rows.length
		let count = 0
		if (len > 10240 && !confirm(`WARNING! TABLE OVER 10K ROWS: ${len}\nJS FILTERING NOT RECOMMENDED. PROCEED?`)) return
		rows.forEach(row =>{
			let cells = columnIndex === null ? row.cells : [row.cells[columnIndex]]
			let found = [...cells].some(cell => (cell?.getAttribute('value') ?? cell?.textContent ?? '').includes(term))
			if (found) {row.style.display = ''; count++}
			else row.style.display = 'none'
		})
		return count
	},
	save(table,sep = '|',filename = 'output.csv'){//Save table as CSV file
		if (!table.tBodies[0] || !table.tHead) return
		const data = [this.getHeaders(table),...[...table.tBodies[0].rows].filter(row => row.style.display != 'none').map(row => [...row.cells].map(cell => cell.getAttribute('value')))]
		const a = Common.oassign('a')
		a.href = URL.createObjectURL(new Blob([data.map(row => row.join(sep)).join('\n')], {type: 'text/csv'}))
		a.download = filename
		a.click()
		URL.revokeObjectURL(a.href)
	}
}

const Util = {//Utility functions
	generateKey(){ // Create 32 character ID.
		const bytes = crypto.getRandomValues(new Uint8Array(24))
		const binary = String.fromCharCode(...bytes)
		return btoa(binary).replace(/[+/]/g, char => char === '+' ? '-' : '_')
	},
	durationToNanos(durationString) {// This is golang specific. eg. 72h30m1s100ms10us5ns
		const NANO_MULTIPLIERS = {
			ns: 1,
			us: 1000,
			ms: 1000 * 1000,
			s: 1000 * 1000 * 1000,
			m: 60 * 1000 * 1000 * 1000,
			h: 60 * 60 * 1000 * 1000 * 1000,
		}
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
}
