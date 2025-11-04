import { Link, LinkProps } from "@chakra-ui/react"

type DeBankLinkProps = {
  address: string
} & Omit<LinkProps, "isExternal">

function DeBankLink({
  address,
  children,
  ...restProps
}: DeBankLinkProps) {
  const link = `https://debank.com/profile/${address}`

  return (
    <Link href={link} isExternal {...restProps}>
      {children ?? address}
    </Link>
  )
}

export default DeBankLink