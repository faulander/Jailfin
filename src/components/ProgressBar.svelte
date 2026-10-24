<script lang="ts">
  let { value }: { value: number } = $props();
</script>

<span class="bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(value)}>
  <span class="fill" style:width={`${Math.min(100, Math.max(0, value))}%`}></span>
</span>

<style>
  .bar {
    display: block;
    height: 5px;
    background: rgb(255 255 255 / 22%);
  }

  .fill {
    display: block;
    height: 100%;
    background: var(--color-accent);
  }
</style>
