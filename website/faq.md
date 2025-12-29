---
layout: page
title: Frequently Asked Questions
description: Common questions about GNO local search. Installation, configuration, search modes, AI answers, MCP integration, and troubleshooting.
keywords: gno faq, local search questions, gno help, common issues, how to use gno
permalink: /faq/
---

Find answers to common questions about GNO.

{% for category in site.data.faq %}
## {{ category.category }}

{% for item in category.questions %}
<details class="faq-item">
<summary class="faq-question">{{ item.q }}</summary>
<div class="faq-answer" markdown="1">
{{ item.a }}
</div>
</details>
{% endfor %}

{% endfor %}

---

## Still Have Questions?

- [Quick Start Guide](/docs/QUICKSTART/) - Get up and running
- [CLI Reference](/docs/CLI/) - All commands explained
- [Troubleshooting](/docs/TROUBLESHOOTING/) - Common issues and fixes
- [GitHub Issues](https://github.com/gmickel/gno/issues) - Report bugs or request features

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {% for category in site.data.faq %}{% for item in category.questions %}{
      "@type": "Question",
      "name": {{ item.q | jsonify }},
      "acceptedAnswer": {
        "@type": "Answer",
        "text": {{ item.a | strip_html | jsonify }}
      }
    }{% unless forloop.last %},{% endunless %}{% endfor %}{% unless forloop.last %},{% endunless %}{% endfor %}
  ]
}
</script>
