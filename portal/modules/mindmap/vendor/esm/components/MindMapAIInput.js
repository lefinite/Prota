import { IconClose as e, IconLightning as t, IconLoaderCircle as n, IconPaperclip as r, IconStop as i } from "./icons.js";
import { useCallback as a, useRef as o, useState as s } from "react";
import { Fragment as c, jsx as l, jsxs as u } from "react/jsx-runtime";
//#region src/components/MindMap/components/MindMapAIInput.tsx
var d = "#Role\nYou are a professional Mind Map Generator specializing in hierarchical information architecture. Your objective is to deconstruct complex topics into a robust, visual Markdown outline.\n\n#Logic and Structure\n- Primary Branches: Use the MECE (Mutually Exclusive, Collectively Exhaustive) principle to ensure no overlap and complete coverage of the topic.\n- Branching Density: Aim for 3-5 primary branches. For narrow topics that do not naturally yield five branches, provide at least 3 branches and prioritize hierarchical depth over breadth.\n- Hierarchical Depth: The structure must not exceed a maximum depth of the Root + 3 levels.\n- Logical Flow: Organize the sequence of branches and sub-nodes based on priority, moving from foundational concepts to advanced applications.\n\n#Formatting Standards\n- Root Node: Place the root node on the first line of the response with no prefix (no hyphen, bullet, or number).\n- Indentation: Use exactly two spaces per level of hierarchy to define the structure.\n- Child Node Prefix: Every child node must start with a hyphen followed by a space (\"- \").\n- Text Constraints: Each node must contain between 2 and 6 visible words. Markdown formatting characters (e.g., **, ==, `) do not count toward this 2-6 word limit.\n- Remarks: Insert contextual notes or brief explanations immediately after relevant nodes using the \"> \" prefix.\n- Inline Styling: Use Obsidian-compatible Markdown for emphasis: **bold**, *italic*, `code`, ~~strikethrough~~, and ==highlighting==.\n\n#Extended Syntax (Optional)\nUse these features only when they naturally enhance the mind map's clarity or structure. Do not force them into every response.\n- Dotted Lines: Use \"-.\" instead of \"-\" for weak, optional, or tentative relationships. Example: \"-. Optional Step\"\n- Multi-line Content: Use \"|\" prefix lines to append additional display lines to a node. Example:\n  - Main Point\n    | Supporting detail line 1\n    | Supporting detail line 2\n- Tags: Add \"#tag\" at the end of node text for categorization. Example: \"- React #frontend #framework\"\n- Cross-links: Define anchors with \"{#id}\" and link with \"-> {#id}\" to connect nodes across branches. Example:\n  - Node A {#a}\n  - Node B\n    -> {#a} \"references\"\n- Folding: Use \"+\" instead of \"-\" to mark a node as initially collapsed (children hidden by default). Example: \"+ Collapsed Section\"\n- LaTeX: Use \"$...$\" for inline math and \"$$...$$\" for display math. Example: \"- Energy: $E = mc^2$\"\n- Frontmatter: Use a \"---\" block at the very top to set layout direction or theme:\n  ---\n  direction: right\n  theme: dark\n  ---\n\n#Example Output\nProject Management\n- **Foundational Concepts** #core\n  - Project Life Cycle\n    > Initiation through closing phases\n    | Planning, executing, monitoring\n  - Stakeholder Identification\n- *Execution Frameworks*\n  - ==Agile Methodologies==\n  -. Hybrid Approaches\n- Advanced Optimization\n  - Resource Load Balancing\n    > Optimizing team allocation\n  - Portfolio Risk Mitigation\n\n#Constraints\n- Provide the raw Markdown output only.\n- Do not include any introductory text, conversational fillers, or explanations.\n- Do not include any concluding remarks or summaries.\n- Use extended syntax features (dotted lines, tags, multi-line, cross-links, etc.) only when they genuinely improve the mind map's clarity or structure. Default to basic syntax.\n- FINAL NEGATIVE CONSTRAINT: Do not wrap the output in markdown code fences. Provide the response as raw, plain text.";
function f(e) {
	if (!e || e.length === 0) return "";
	let t = [];
	for (let n of e) n === "text" ? t.push("text/*,.json,.js,.ts,.xml,.yaml,.yml,.sql,.sh,.md") : n === "image" ? t.push("image/*") : n === "pdf" && t.push("application/pdf");
	return t.join(",");
}
function p(e, t) {
	if (t.length === 0) return e;
	let n = [{
		type: "text",
		text: e
	}];
	for (let e of t) if (e.type.startsWith("image/")) n.push({
		type: "image_url",
		image_url: { url: e.base64 }
	});
	else {
		let t = atob(e.base64.split(",")[1] || "");
		n.push({
			type: "text",
			text: `[File: ${e.name}]\n${t}`
		});
	}
	return n;
}
function m(e) {
	let t = e.replace(/<think>[\s\S]*?<\/think>/g, "");
	return t = t.replace(/<think>[\s\S]*$/, ""), t;
}
async function* h(e) {
	let t = new TextDecoder(), n = "";
	for (;;) {
		let { done: r, value: i } = await e.read();
		if (r) break;
		n += t.decode(i, { stream: !0 });
		let a = n.split("\n");
		n = a.pop() || "";
		for (let e of a) {
			let t = e.trim();
			if (t === "data: [DONE]") return;
			if (t.startsWith("data: ")) try {
				let e = JSON.parse(t.slice(6)).choices?.[0]?.delta?.content;
				e && (yield e);
			} catch {}
		}
	}
}
function g({ config: g, theme: _, messages: v, currentMarkdown: y, onMarkdownStream: b, onComplete: x, onError: S }) {
	let [C, w] = s(""), [T, E] = s(!1), [D, O] = s([]), [k, A] = s(null), j = o(null), M = o(null), N = o(0), P = g.attachments && g.attachments.length > 0, F = a(async () => {
		let e = C.trim();
		if (!e && D.length === 0 || T) return;
		E(!0), A(null);
		let t = new AbortController();
		j.current = t;
		try {
			let n = p(e, D), r = g.systemPrompt || d, i = y?.trim() ? `${r}\n\n#Current Mind Map\nThe user already has the following mind map. They may ask you to modify, expand, or optimize it. If the user's request is about the existing content, use it as the base and output the updated version. If the request is about a new topic, generate a fresh mind map.\n\n\`\`\`\n${y.trim()}\n\`\`\`` : r, a = JSON.stringify({
				model: g.model,
				messages: [{
					role: "system",
					content: i
				}, {
					role: "user",
					content: n
				}],
				stream: !0
			}), o = await fetch(g.apiUrl, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${g.apiKey}`
				},
				body: a,
				signal: t.signal
			});
			if (!o.ok) throw Error(`API error: ${o.status}`);
			let s = o.body?.getReader();
			if (!s) throw Error("No response body");
			let c = "", l = !1;
			for await (let e of h(s)) if (c += e, !l) {
				l = !0;
				let e = m(c);
				N.current = requestAnimationFrame(() => {
					b(e), l = !1;
				});
			}
			cancelAnimationFrame(N.current), c && b(m(c)), w(""), O([]), x();
		} catch (e) {
			if (e.name === "AbortError") x();
			else {
				let t = e.message || v.aiError;
				A(t), S(t), setTimeout(() => A(null), 4e3);
			}
		} finally {
			E(!1), j.current = null;
		}
	}, [
		C,
		D,
		T,
		g,
		y,
		v,
		b,
		x,
		S
	]), I = a(() => {
		j.current?.abort();
	}, []), L = a((e) => {
		e.key === "Enter" && !e.shiftKey && (e.preventDefault(), F());
	}, [F]), R = a((e) => {
		let t = e.target.files;
		t && (Array.from(t).forEach((e) => {
			let t = new FileReader();
			t.onload = () => {
				O((n) => [...n, {
					name: e.name,
					type: e.type,
					base64: t.result
				}]);
			}, t.readAsDataURL(e);
		}), e.target.value = "");
	}, []), z = a((e) => {
		O((t) => t.filter((t, n) => n !== e));
	}, []);
	return /* @__PURE__ */ u("div", {
		className: "mindmap-ai-input",
		children: [
			D.length > 0 && /* @__PURE__ */ l("div", {
				className: "mindmap-ai-file-previews",
				children: D.map((t, n) => /* @__PURE__ */ u("span", {
					className: "mindmap-ai-file-chip",
					children: [/* @__PURE__ */ l("span", {
						className: "mindmap-ai-file-name",
						children: t.name
					}), /* @__PURE__ */ l("button", {
						className: "mindmap-ai-file-remove",
						onClick: () => z(n),
						children: /* @__PURE__ */ l(e, { size: 12 })
					})]
				}, n))
			}),
			/* @__PURE__ */ u("div", {
				className: "mindmap-ai-input-row",
				children: [
					P && /* @__PURE__ */ u(c, { children: [/* @__PURE__ */ l("button", {
						className: "mindmap-ai-attach-btn",
						onClick: () => M.current?.click(),
						disabled: T,
						title: v.aiPlaceholder,
						children: /* @__PURE__ */ l(r, { size: 18 })
					}), /* @__PURE__ */ l("input", {
						ref: M,
						type: "file",
						accept: f(g.attachments),
						multiple: !0,
						style: { display: "none" },
						onChange: R
					})] }),
					/* @__PURE__ */ l("input", {
						className: "mindmap-ai-input-field",
						type: "text",
						value: T ? "" : C,
						onChange: (e) => w(e.target.value),
						onKeyDown: L,
						placeholder: T ? v.aiGenerating : v.aiPlaceholder,
						disabled: T
					}),
					/* @__PURE__ */ l("button", {
						className: `mindmap-ai-send-btn${T ? " mindmap-ai-send-btn--loading" : ""}`,
						onClick: T ? I : F,
						disabled: !T && !C.trim() && D.length === 0,
						style: {
							background: T ? "transparent" : !C.trim() && D.length === 0 ? _.controls.hoverBg : _.root.bgColor,
							color: T || !C.trim() && D.length === 0 ? _.controls.textColor : _.root.textColor
						},
						children: T ? /* @__PURE__ */ u(c, { children: [/* @__PURE__ */ l("span", {
							className: "mindmap-ai-spinner",
							children: /* @__PURE__ */ l(n, { size: 20 })
						}), /* @__PURE__ */ l("span", {
							className: "mindmap-ai-stop-icon",
							children: /* @__PURE__ */ l(i, { size: 16 })
						})] }) : /* @__PURE__ */ l(t, { size: 16 })
					})
				]
			}),
			k && /* @__PURE__ */ l("div", {
				className: "mindmap-ai-error",
				children: k
			})
		]
	});
}
//#endregion
export { g as MindMapAIInput };
