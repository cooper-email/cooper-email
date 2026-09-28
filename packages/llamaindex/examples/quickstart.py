import os

from cooper_email import Cooper
from cooper_email_llamaindex import CooperEmailToolSpec

client = Cooper(api_key=os.environ["COOPER_API_KEY"])
spec = CooperEmailToolSpec(client)
print(spec.cooper_search(q="tuesday"))

# When llama-index-core is installed:
# tools = spec.to_tool_list()
