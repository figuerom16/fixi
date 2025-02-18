(()=>{
	if(document.__fixi_mo) return;
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
			if (!form && elt.name) body.append(elt.name, elt.value)
			let ac = new AbortController()
			let cfg = {
				trigger:evt,
				action:attr(elt, "fx-action"),
				method:attr(elt, "fx-method", "GET").toUpperCase(),
				target:document.querySelector(attr(elt, "fx-target")) ?? elt,
				swap:attr(elt, "fx-swap", "outerHTML"),
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
				let params = new URLSearchParams(cfg.body)
				if (params.size)
					cfg.action += (/\?/.test(cfg.action) ? "&" : "?") + params
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
			let doSwap = ()=>{
				if (cfg.swap instanceof Function)
					return cfg.swap(cfg)
				else if (/(before|after)(start|end)/.test(cfg.swap))
					cfg.target.insertAdjacentHTML(cfg.swap, cfg.text)
				else if(cfg.swap in cfg.target)
					cfg.target[cfg.swap] = cfg.text
				else throw cfg.swap
			}
			if (cfg.transition)
				await cfg.transition(doSwap).finished
			else
				await doSwap()
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
			if (n.matches("[fx-action]")) init(n)
		}
		if(n.querySelectorAll) n.querySelectorAll("[fx-action]").forEach(init)
	}
	document.addEventListener("fx:process", (evt)=>process(evt.target))
	document.addEventListener("DOMContentLoaded", ()=>{
		document.__fixi_mo.observe(document.documentElement, {childList:true, subtree:true})
		process(document.body)
	})
})()

document.addEventListener('fx:config',e=>{//Relative Selectors
	const target = e.target.getAttribute("fx-target") || ""
	if(target.indexOf("closest ") == 0) e.detail.cfg.target = e.target.closest(target.substring(8))
	else if(target.indexOf("find ") == 0) e.detail.cfg.target = e.target.closest(target.substring(5))
	else if(target.indexOf("next ") == 0){
		const matches = Array.from(document.querySelectorAll(target.substring(5)))
		e.detail.cfg.target = matches.find((el)=>e.target.compareDocumentPosition(el) === Node.DOCUMENT_POSITION_FOLLOWING)
	} else if(target.indexOf("previous ") == 0){
		const matches = Array.from(document.querySelectorAll(target.substring(9))).reverse()
		e.detail.cfg.target = matches.find((el)=>e.target.compareDocumentPosition(el) === Node.DOCUMENT_POSITION_PRECEDING)
	}
})

document.addEventListener("fx:init",e=>{//Debounce/Delay
	const el = e.target
	if(!el.matches("[fx-delay]")) return
	let latestPromise = null
	el.addEventListener("fx:config",e=>{
		e.detail.drop = false
		e.detail.cfg.confirm =_=>{
			let currentPromise = latestPromise = new Promise((resolve)=>{
				setTimeout(_=>{resolve(currentPromise === latestPromise)}, parseInt(el.getAttribute("fx-delay")))
			})
		return currentPromise
	}})
})

document.addEventListener("fx:init",e=>{//Disable During Request
	if(!e.target.matches("[fx-disable]")) return
	const disableSelector = e.target.getAttribute('fx-disable')
	e.target.addEventListener('fx:before',_=>{
		let disableTarget = disableSelector == "" ? e.target : document.querySelector(disableSelector)
		disableTarget.disabled = true
		e.target.addEventListener('fx:after', (afterEvt)=>{if(afterEvt.target == e.target) disableTarget.disabled = false})
	})
})

document.addEventListener("fx:config",e=>{//Confirm Dialog
	const confirmationMessage = e.target.getAttribute("fx-confirm")
	if(confirmationMessage) e.detail.cfg.confirm =_=>confirm(confirmationMessage)
})

document.addEventListener("fx:config",e=>{//Enctype
	if(!e.target.matches("[fx-enctype]")) return
	const enctype = e.target.getAttribute("fx-enctype")
	if(enctype) e.detail.cfg.headers["Content-Type"] = enctype
})

document.addEventListener("fx:init",e=>{//Polling
	let el = e.target
	if(!el.matches("[fx-poll]")) return
	el.addEventListener("fx:inited",_=>{
		el.__fixi.pollInterval = setInterval(_=>{el.dispatchEvent(new CustomEvent("poll"))}, parseInt(el.getAttribute("fx-poll")))
	})
})

document.addEventListener('fx:init',e=>{//Row
	if(!e.target.closest('[fx-row]')) return
	document.addEventListener('fx:config',e=>{
		const row = e.target.closest('tr')
		if(!row){console.error('fx-table no table row found');return}
		for (let cell of row.cells){
			const name = cell.getAttribute('name')
			if(name) e.detail.cfg.body.append(name, cell.innerText.trim())
		}
	})
})

document.addEventListener('fx:init',e=>{//Vals
	if(!e.target.matches('[fx-vals]')) return
	document.addEventListener('fx:config',e=>{
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
})

document.addEventListener('fx:before',_=>{//Clear Error & Success
	me('#error').textContent = me('#success').textContent = ''
})

document.addEventListener('fx:after',e=>{//Set Error & Success
	if(e.detail.cfg.response.status < 400) setTimeout(_=>{me('#success').textContent = ''}, 2000)
	else {
		e.detail.cfg.target = me('#error')
		e.detail.cfg.swap = 'innerHTML'
	}
})

document.addEventListener('fx:swapped',e=>{//Lucide Render
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
