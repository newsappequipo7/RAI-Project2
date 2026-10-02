<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
</script>

<p><a href={resolve('/news')}>← Noticias</a></p>
<h1>Noticia {page.params.id}</h1>
<p>El editor se implementa en F2-02.</p>
