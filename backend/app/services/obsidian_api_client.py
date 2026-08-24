import httpx
from typing import List, Dict, Any, Tuple
import asyncio

class ObsidianApiClient:
    def __init__(self, api_url: str, api_key: str):
        # Ensure url doesn't end with /
        self.api_url = api_url.rstrip('/')
        self.headers = {
            "Authorization": f"Bearer {api_key}",
            "Accept": "application/json"
        }

    async def list_vault_files(self) -> List[str]:
        """Fetch all markdown files from the vault."""
        # The Local REST API uses /search/ or /vault/ to list files.
        # According to Local REST API docs, GET /vault/ returns a JSON tree of files.
        # Alternatively, GET /search/ with an empty query might return all files.
        # Let's use GET /vault/ which returns directory structure.
        async with httpx.AsyncClient(verify=False) as client:
            response = await client.get(
                f"{self.api_url}/vault/",
                headers=self.headers
            )
            response.raise_for_status()
            data = response.json()
            
            # The API returns an object for a folder. We need to parse recursively.
            return self._extract_markdown_paths(data)

    def _extract_markdown_paths(self, node: Dict[str, Any], current_path: str = "") -> List[str]:
        paths = []
        if 'files' in node: # It's a folder
            for child in node['files']:
                paths.extend(self._extract_markdown_paths(child))
        else: # Might be the root or direct file
            pass 
        
        # Actually, the Local REST API returns an array of files/folders at the root if queried properly.
        # Format for GET /vault/:
        # {
        #   "files": [
        #     {"path": "file1.md", "name": "file1.md", "content": "..."} // Wait, /vault/ returns array or object?
        #   ]
        # }
        
        # Let's use the simplest approach. Local REST API `GET /search/` with `query=*` or similar?
        # Actually, let's just make it robust. If we get a flat list from somewhere or use search:
        # A safer bet for Obsidian Local REST API is `POST /search/` with empty query:
        # Request: {"query": ""} -> returns list of files matching.
        # Let's implement reading files by searching for ".md".
        return paths

    async def fetch_file_content(self, filepath: str) -> str:
        """Fetch the content of a specific markdown file."""
        # We need to URL encode the filepath
        # But for httpx, we can just pass it in the path
        async with httpx.AsyncClient(verify=False) as client:
            response = await client.get(
                f"{self.api_url}/vault/{filepath}",
                headers={"Authorization": self.headers["Authorization"], "Accept": "text/markdown"}
            )
            response.raise_for_status()
            return response.text

    async def get_all_markdown_contents(self) -> List[Tuple[str, str]]:
        """
        Fetch all markdown files and their contents.
        Since we might not know the exact file structure, we can use the /search/ endpoint 
        to find all files with 'type: question' or just '.md' extension.
        """
        async with httpx.AsyncClient(verify=False) as client:
            # Let's use a simple POST /search/ to find all files with '---' (which implies frontmatter)
            search_query = {"query": "type: question"}
            response = await client.post(
                f"{self.api_url}/search/",
                headers=self.headers,
                json=search_query
            )
            
            if response.status_code != 200:
                raise Exception(f"Failed to search Obsidian vault: {response.text}")
                
            results = response.json()
            
            # The search endpoint returns an array of matches.
            # Usually: [{"filename": "...", "result": {...}}] or similar.
            # Actually, standard Obsidian Local REST API search returns:
            # [ { "filename": "path/to/file.md", "score": 1.0, ... } ]
            file_paths = []
            if isinstance(results, list):
                file_paths = [item.get("filename") for item in results if isinstance(item, dict) and "filename" in item]
            
            # Now fetch contents for each file
            file_contents = []
            for path in file_paths:
                if not path.endswith('.md'):
                    continue
                content = await self.fetch_file_content(path)
                file_contents.append((path, content))
                
            return file_contents
