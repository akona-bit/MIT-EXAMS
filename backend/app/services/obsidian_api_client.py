import asyncio
from typing import Any, List, Tuple
from urllib.parse import quote

import httpx


class ObsidianApiClient:
    def __init__(self, api_url: str, api_key: str, verify_ssl: bool = True):
        self.api_url = api_url.rstrip('/')
        self.headers = {
            'Authorization': f'Bearer {api_key}',
            'Accept': 'application/json',
        }
        self.verify_ssl = verify_ssl
        self.timeout = httpx.Timeout(20.0, connect=5.0)

    async def _request(self, method: str, url: str, **kwargs: Any) -> httpx.Response:
        request_headers = {**self.headers, **kwargs.pop('headers', {})}
        last_error: Exception | None = None

        for attempt in range(3):
            try:
                async with httpx.AsyncClient(
                    verify=self.verify_ssl,
                    timeout=self.timeout,
                ) as client:
                    response = await client.request(
                        method,
                        url,
                        headers=request_headers,
                        **kwargs,
                    )

                if response.status_code not in {408, 429, 500, 502, 503, 504}:
                    response.raise_for_status()
                    return response

                last_error = httpx.HTTPStatusError(
                    f'Obsidian API returned HTTP {response.status_code}',
                    request=response.request,
                    response=response,
                )
            except (httpx.TimeoutException, httpx.NetworkError, httpx.HTTPStatusError) as error:
                last_error = error

            if attempt < 2:
                await asyncio.sleep(0.25 * (attempt + 1))

        raise RuntimeError(f'Obsidian API request failed: {last_error}') from last_error

    async def list_vault_files(self) -> List[str]:
        response = await self._request('GET', f'{self.api_url}/vault/')
        return self._extract_markdown_paths(response.json())

    def _extract_markdown_paths(self, node: Any) -> List[str]:
        paths: List[str] = []
        if isinstance(node, list):
            for child in node:
                paths.extend(self._extract_markdown_paths(child))
        elif isinstance(node, dict):
            path = node.get('path') or node.get('filename')
            if isinstance(path, str) and path.lower().endswith('.md'):
                paths.append(path)
            for child in node.get('files', []):
                paths.extend(self._extract_markdown_paths(child))
        return paths

    async def fetch_file_content(self, filepath: str) -> str:
        encoded_path = quote(filepath.lstrip('/'), safe='/')
        response = await self._request(
            'GET',
            f'{self.api_url}/vault/{encoded_path}',
            headers={'Accept': 'text/markdown'},
        )
        return response.text

    async def get_all_markdown_contents(self) -> List[Tuple[str, str]]:
        response = await self._request(
            'POST',
            f'{self.api_url}/search/',
            json={'query': 'type: question'},
        )
        results = response.json()
        file_paths: List[str] = []
        if isinstance(results, list):
            for item in results:
                if not isinstance(item, dict):
                    continue
                path = item.get('filename') or item.get('path')
                if isinstance(path, str) and path.lower().endswith('.md'):
                    file_paths.append(path)
        file_paths = [
            path for path in file_paths
            if isinstance(path, str) and path.lower().endswith('.md')
        ]

        semaphore = asyncio.Semaphore(8)

        async def fetch(path: str) -> Tuple[str, str]:
            async with semaphore:
                return path, await self.fetch_file_content(path)

        return list(await asyncio.gather(*(fetch(path) for path in file_paths)))
