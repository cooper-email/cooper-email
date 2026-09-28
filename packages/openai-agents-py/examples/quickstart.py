import os

from agents import Agent, function_tool
from cooper_email import Cooper
from cooper_email_openai_agents import function_tools

client = Cooper(api_key=os.environ["COOPER_API_KEY"])
tools = [function_tool(fn) for fn in function_tools(client)]
mail = Agent(name="Cooper mail", instructions="Send, read, and search Cooper Email.", tools=tools)
